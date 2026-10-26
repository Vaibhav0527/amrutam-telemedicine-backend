import jwt from 'jsonwebtoken';
import { prisma } from '../../database/prisma';
import { config } from '../../config';
import { hashPassword, comparePassword } from '../../security/hash';
import { generateMfaSecret, verifyMfaToken, MfaSetupResult } from '../../security/totp';
import { auditService } from '../audit/audit.service';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '../../common/errors';
import { z } from 'zod';
import { registerSchema, loginSchema } from './auth.schema';

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export class AuthService {
  async register(input: RegisterInput, ipAddress?: string, userAgent?: string) {
    // Check if user exists
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: input.email }, { phone: input.phone }],
      },
    });

    if (existing) {
      throw new ConflictError('User with this email or phone already exists');
    }

    const passwordHash = await hashPassword(input.password);

    // Create user with profile inside an ACID transaction
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: input.email.toLowerCase(),
          phone: input.phone,
          passwordHash,
          role: input.role,
          profile: {
            create: {
              firstName: input.profile.firstName,
              lastName: input.profile.lastName,
              gender: input.profile.gender,
              dateOfBirth: input.profile.dateOfBirth ? new Date(input.profile.dateOfBirth) : null,
              address: input.profile.address,
              emergencyContact: input.profile.emergencyContact,
            },
          },
        },
        include: { profile: true },
      });

      // If doctor role, initialize doctor record
      if (input.role === 'DOCTOR') {
        if (!input.doctorDetails) {
          throw new BadRequestError('Doctor details are required when registering as a doctor');
        }

        await tx.doctor.create({
          data: {
            userId: newUser.id,
            licenseNumber: input.doctorDetails.licenseNumber,
            specialties: input.doctorDetails.specialties,
            yearsOfExperience: input.doctorDetails.yearsOfExperience,
            consultationFee: input.doctorDetails.consultationFee,
            bio: input.doctorDetails.bio,
          },
        });
      }

      return newUser;
    });

    // Write audit log
    await auditService.log({
      userId: user.id,
      action: 'USER_REGISTERED',
      resourceType: 'USER',
      resourceId: user.id,
      newState: { email: user.email, role: user.role },
      ipAddress,
      userAgent,
    });

    const tokens = this.generateTokens(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profile: user.profile,
      },
      ...tokens,
    };
  }

  async login(input: LoginInput, ipAddress?: string, userAgent?: string) {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: { profile: true, doctor: true },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isMatch = await comparePassword(input.password, user.passwordHash);
    if (!isMatch) {
      await auditService.log({
        userId: user.id,
        action: 'LOGIN_FAILED',
        resourceType: 'AUTH',
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check if MFA is enabled
    if (user.isMfaEnabled) {
      if (!input.mfaToken) {
        return {
          mfaRequired: true,
          userId: user.id,
          message: 'MFA verification required. Please provide 6-digit TOTP token.',
        };
      }

      if (!user.mfaSecret) {
        throw new BadRequestError('MFA state is corrupted. Please contact support.');
      }

      const isValidMfa = verifyMfaToken(input.mfaToken, user.mfaSecret);
      if (!isValidMfa) {
        throw new UnauthorizedError('Invalid MFA verification code');
      }
    }

    await auditService.log({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      resourceType: 'AUTH',
      ipAddress,
      userAgent,
    });

    const tokens = this.generateTokens(user.id, user.email, user.role);

    return {
      mfaRequired: false,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: user.profile,
        doctor: user.doctor,
        isMfaEnabled: user.isMfaEnabled,
      },
      ...tokens,
    };
  }

  async setupMfa(userId: string): Promise<MfaSetupResult> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');

    const mfaData = await generateMfaSecret(user.email);

    // Temporarily save secret
    await prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: mfaData.secret },
    });

    return mfaData;
  }

  async verifyAndEnableMfa(userId: string, token: string, ipAddress?: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaSecret) {
      throw new BadRequestError('MFA setup has not been initiated for this user');
    }

    const isValid = verifyMfaToken(token, user.mfaSecret);
    if (!isValid) {
      throw new UnauthorizedError('Invalid MFA verification code');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isMfaEnabled: true },
    });

    await auditService.log({
      userId,
      action: 'MFA_ENABLED',
      resourceType: 'AUTH',
      resourceId: userId,
      ipAddress,
    });

    return true;
  }

  async refreshToken(token: string) {
    try {
      const decoded = jwt.verify(token, config.JWT_REFRESH_SECRET) as any;
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });

      if (!user) {
        throw new UnauthorizedError('User does not exist');
      }

      return this.generateTokens(user.id, user.email, user.role);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }
  }

  private generateTokens(id: string, email: string, role: string) {
    const accessToken = jwt.sign(
      { id, email, role },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN as any }
    );

    const refreshToken = jwt.sign(
      { id, email, role },
      config.JWT_REFRESH_SECRET,
      { expiresIn: config.JWT_REFRESH_EXPIRES_IN as any }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: config.JWT_EXPIRES_IN,
    };
  }
}

export const authService = new AuthService();
