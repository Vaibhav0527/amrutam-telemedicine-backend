import { prisma } from '../../database/prisma';
import { encryptPHI, decryptPHI } from '../../security/encryption';
import { auditService } from '../audit/audit.service';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../common/errors';
import crypto from 'crypto';

export class PrescriptionService {
  async issuePrescription(params: {
    consultationId: string;
    doctorId: string; // user id
    diagnosis: string;
    medicinesDosage: any[];
    dietaryLifestyleAdvice?: string;
    privateClinicalNotes?: string;
    ipAddress?: string;
  }) {
    const {
      consultationId,
      doctorId: userId,
      diagnosis,
      medicinesDosage,
      dietaryLifestyleAdvice,
      privateClinicalNotes,
      ipAddress,
    } = params;

    // Verify doctor
    const doctor = await prisma.doctor.findUnique({
      where: { userId },
    });
    if (!doctor) {
      throw new NotFoundError('Doctor profile not found');
    }

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: { prescription: true },
    });

    if (!consultation) {
      throw new NotFoundError('Consultation not found');
    }

    if (consultation.doctorId !== doctor.id) {
      throw new ForbiddenError('You can only issue prescriptions for your own consultations');
    }

    if (consultation.prescription) {
      throw new ConflictError('A prescription has already been issued for this consultation');
    }

    // Encrypt sensitive PHI using AES-256-GCM
    const encryptedPrivateNotes = privateClinicalNotes
      ? encryptPHI(privateClinicalNotes)
      : null;

    // Generate digital signature
    const signaturePayload = `${consultation.consultationNumber}:${doctor.licenseNumber}:${new Date().toISOString()}`;
    const digitalSignature = crypto
      .createHash('sha256')
      .update(signaturePayload)
      .digest('hex');

    const prescription = await prisma.prescription.create({
      data: {
        consultationId,
        doctorId: doctor.id,
        patientId: consultation.patientId,
        diagnosis,
        medicinesDosage,
        dietaryLifestyleAdvice,
        encryptedPrivateNotes,
        digitalSignature: `AMR-SIG-${digitalSignature.substring(0, 16).toUpperCase()}`,
      },
    });

    // Mark consultation as COMPLETED if not already
    if (consultation.status !== 'COMPLETED') {
      await prisma.consultation.update({
        where: { id: consultationId },
        data: { status: 'COMPLETED', endedAt: new Date() },
      });
    }

    await auditService.log({
      userId,
      action: 'PRESCRIPTION_ISSUED',
      resourceType: 'PRESCRIPTION',
      resourceId: prescription.id,
      newState: {
        consultationNumber: consultation.consultationNumber,
        medicineCount: medicinesDosage.length,
        digitalSignature: prescription.digitalSignature,
      },
      ipAddress,
    });

    return prescription;
  }

  async getPrescription(consultationId: string, userId: string, role: string) {
    const prescription = await prisma.prescription.findUnique({
      where: { consultationId },
      include: {
        doctor: {
          include: {
            user: { select: { profile: true } },
          },
        },
      },
    });

    if (!prescription) {
      throw new NotFoundError('Prescription not found for this consultation');
    }

    // Authorization
    let isDoctor = false;
    if (role === 'DOCTOR') {
      const doctor = await prisma.doctor.findUnique({ where: { userId } });
      isDoctor = doctor?.id === prescription.doctorId;
    }
    const isPatient = prescription.patientId === userId;

    if (!isDoctor && !isPatient && role !== 'ADMIN') {
      throw new ForbiddenError('You are not authorized to view this prescription');
    }

    // Safe decryption of PHI notes only if doctor or admin
    let decryptedNotes = null;
    if (isDoctor || role === 'ADMIN') {
      if (prescription.encryptedPrivateNotes) {
        decryptedNotes = decryptPHI(prescription.encryptedPrivateNotes);
      }
    }

    return {
      ...prescription,
      decryptedPrivateNotes: decryptedNotes,
      encryptedPrivateNotes: undefined, // Strip raw ciphertext
    };
  }
}

export const prescriptionService = new PrescriptionService();
