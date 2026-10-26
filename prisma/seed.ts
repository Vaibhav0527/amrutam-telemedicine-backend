import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { encryptPHI } from '../src/security/encryption';
import { computeAuditTamperHash } from '../src/security/hash';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Amrutam Telemedicine Database...');

  const passwordHash = await bcrypt.hash('AmrutamSecure2026!', 10);

  // 1. Seed Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@amrutam.co.in' },
    update: {},
    create: {
      email: 'admin@amrutam.co.in',
      phone: '+919999999901',
      passwordHash,
      role: 'ADMIN',
      isVerified: true,
      profile: {
        create: {
          firstName: 'Amrutam',
          lastName: 'SuperAdmin',
          gender: 'OTHER',
        },
      },
    },
  });
  console.log('✅ Admin seeded:', admin.email);

  // 2. Seed Ayurvedic Doctors
  const doctorUser1 = await prisma.user.upsert({
    where: { email: 'dr.arvind@amrutam.co.in' },
    update: {},
    create: {
      email: 'dr.arvind@amrutam.co.in',
      phone: '+919811122233',
      passwordHash,
      role: 'DOCTOR',
      isVerified: true,
      profile: {
        create: {
          firstName: 'Arvind',
          lastName: 'Sharma',
          gender: 'MALE',
          dateOfBirth: new Date('1982-04-12'),
        },
      },
      doctor: {
        create: {
          licenseNumber: 'AYUSH-DEL-10492',
          specialties: ['Nadi Pariksha', 'Kayachikitsa', 'Digestive Health'],
          yearsOfExperience: 16,
          consultationFee: 750.0,
          rating: 4.95,
          totalReviews: 240,
          bio: 'Gold medalist Ayurvedic Vaidya specializing in chronic gut disorders and pulse diagnosis.',
        },
      },
    },
    include: { doctor: true },
  });

  const doctorUser2 = await prisma.user.upsert({
    where: { email: 'dr.sneha@amrutam.co.in' },
    update: {},
    create: {
      email: 'dr.sneha@amrutam.co.in',
      phone: '+919822233344',
      passwordHash,
      role: 'DOCTOR',
      isVerified: true,
      profile: {
        create: {
          firstName: 'Sneha',
          lastName: 'Kulkarni',
          gender: 'FEMALE',
          dateOfBirth: new Date('1989-08-25'),
        },
      },
      doctor: {
        create: {
          licenseNumber: 'AYUSH-MAH-84201',
          specialties: ['Panchakarma', 'Skin & Hair Wellness', 'Stress Management'],
          yearsOfExperience: 10,
          consultationFee: 600.0,
          rating: 4.88,
          totalReviews: 185,
          bio: 'Certified Panchakarma physician with deep clinical focus on holistic stress relief.',
        },
      },
    },
    include: { doctor: true },
  });
  console.log('✅ Doctors seeded: Dr. Arvind & Dr. Sneha');

  // 3. Seed Patients
  const patient1 = await prisma.user.upsert({
    where: { email: 'patient.rohit@amrutam.co.in' },
    update: {},
    create: {
      email: 'patient.rohit@amrutam.co.in',
      phone: '+919733344455',
      passwordHash,
      role: 'PATIENT',
      isVerified: true,
      profile: {
        create: {
          firstName: 'Rohit',
          lastName: 'Verma',
          gender: 'MALE',
          dateOfBirth: new Date('1995-11-20'),
          address: 'B-402, Green Park, New Delhi',
        },
      },
    },
  });

  const patient2 = await prisma.user.upsert({
    where: { email: 'patient.ananya@amrutam.co.in' },
    update: {},
    create: {
      email: 'patient.ananya@amrutam.co.in',
      phone: '+919744455566',
      passwordHash,
      role: 'PATIENT',
      isVerified: true,
      profile: {
        create: {
          firstName: 'Ananya',
          lastName: 'Iyer',
          gender: 'FEMALE',
          dateOfBirth: new Date('1998-02-14'),
          address: '77, Indiranagar, Bangalore',
        },
      },
    },
  });
  console.log('✅ Patients seeded: Rohit & Ananya');

  // 4. Seed Slots for Dr. Arvind (Upcoming slots)
  if (doctorUser1.doctor) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    const slot1End = new Date(tomorrow);
    slot1End.setMinutes(30);

    const slot2Start = new Date(slot1End);
    const slot2End = new Date(slot2Start);
    slot2End.setMinutes(slot2Start.getMinutes() + 30);

    await prisma.availabilitySlot.createMany({
      data: [
        {
          doctorId: doctorUser1.doctor.id,
          startTime: tomorrow,
          endTime: slot1End,
          status: 'AVAILABLE',
        },
        {
          doctorId: doctorUser1.doctor.id,
          startTime: slot2Start,
          endTime: slot2End,
          status: 'AVAILABLE',
        },
      ],
      skipDuplicates: true,
    });
    console.log('✅ Upcoming availability slots seeded for Dr. Arvind');
  }

  // 5. Seed Genesis Audit Log
  const initialHash = computeAuditTamperHash(
    '00000000000000000000000000000000',
    admin.id,
    'SYSTEM_GENESIS_SEED',
    'SYSTEM',
    'system-init',
    new Date().toISOString(),
    { initialized: true, version: '1.0.0' }
  );

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'SYSTEM_GENESIS_SEED',
      resourceType: 'SYSTEM',
      resourceId: 'genesis',
      newState: { status: 'INITIALIZED' },
      tamperHash: initialHash,
    },
  });
  console.log('✅ Genesis cryptographic audit log seeded');

  console.log('🎉 Seed complete! All initial records successfully created.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
