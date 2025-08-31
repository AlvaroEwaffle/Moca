import { Router } from 'express';
import { PatientService } from '../services/patient.service';
import { AuthService } from '../services/auth.service';

const router = Router();

// Middleware to verify JWT token
const authenticateToken = (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = AuthService.verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    console.log('❌ Invalid token:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};



// Get all patients for the authenticated doctor
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('👶 Patient list request received');
    console.log('👨‍⚕️ Requested by doctor:', req.user?.email);
    
    const doctorId = req.user?.userId;
    if (!doctorId) {
      return res.status(401).json({ error: 'User ID not found in token' });
    }

    console.log('🔍 Fetching patients for doctor:', doctorId);
    
    // First, let's check what's in the database directly
    const Patient = require('../models').Patient;
    const allPatients = await Patient.find({}).lean();
    console.log('🔍 [DEBUG] All patients in database:', allPatients.length);
    console.log('🔍 [DEBUG] Sample patient data:', allPatients.slice(0, 2));
    
    const patientsByDoctor = await Patient.find({ doctorId }).lean();
    console.log('🔍 [DEBUG] Patients with this doctorId:', patientsByDoctor.length);
    console.log('🔍 [DEBUG] Sample patients by doctor:', patientsByDoctor.slice(0, 2));
    
    const activePatientsByDoctor = await Patient.find({ doctorId, isActive: true }).lean();
    console.log('🔍 [DEBUG] Active patients with this doctorId:', activePatientsByDoctor.length);
    
    // Get patients using PatientService
    const result = await PatientService.getPatientsByDoctor(doctorId);
    
    console.log('✅ Found', result.patients.length, 'patients for doctor:', doctorId);

    res.json({
      success: true,
      message: 'Patients retrieved successfully',
      patients: result.patients.map(patient => ({
        id: patient.id,
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
        doctorId: patient.doctorId,
        createdAt: patient.createdAt,
        updatedAt: patient.updatedAt
      })),
      pagination: {
        total: result.total,
        page: result.page,
        totalPages: result.totalPages
      }
    });

  } catch (error) {
    console.error('❌ Patient list error:', error);
    res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch patients' 
    });
  }
});

// Create new patient (Protected - requires authentication)
router.post('/create', authenticateToken, async (req, res) => {
  try {
    console.log('👶 Patient creation request received');
    console.log('📝 Request body:', JSON.stringify(req.body, null, 2));
    console.log('👨‍⚕️ Requested by doctor:', req.user?.email);
    
    const { name, email, phone, notes, doctorPhone } = req.body;

    // Validate required fields
    if (!name || !phone || !doctorPhone) {
      console.log('❌ Missing required fields: name, phone, and doctorPhone are required');
      return res.status(400).json({ 
        error: 'Missing required fields: name, phone, and doctorPhone are required' 
      });
    }

    console.log('✅ All required fields present, proceeding with patient creation...');
    console.log('👶 Patient data:', { 
      name, 
      email: email || 'Not provided', 
      phone, 
      notes: notes || 'Not provided',
      doctorPhone 
    });

    // Find doctor by phone number
    console.log('🔍 Searching for doctor with phone:', doctorPhone);
    const doctor = await PatientService.findDoctorByPhone(doctorPhone);
    
    if (!doctor) {
      console.log('❌ Doctor not found with phone:', doctorPhone);
      return res.status(404).json({ 
        error: 'Doctor not found with the provided phone number' 
      });
    }

    console.log('✅ Doctor found:', { id: doctor.id, name: doctor.name, phone: doctor.phone });

    // Create patient using PatientService (this will save to database)
    const patientData = {
      doctorId: doctor.id,
      name,
      phone,
      email
    };

    console.log('💾 Creating patient in database with data:', patientData);
    const patient = await PatientService.createPatient(patientData);

    console.log('✅ Patient created successfully in database:', patient.id);

    // Generate WhatsApp link
          const whatsappMessage = encodeURIComponent(`Hola ${name}! 👋 Soy el asistente virtual de Moca. ¿En qué puedo ayudarte hoy?`);
    const whatsappLink = `https://wa.me/${phone.replace(/\D/g, '')}?text=${whatsappMessage}`;
    
    console.log('📱 WhatsApp link generated:', whatsappLink);

    res.status(201).json({
      message: 'Patient created successfully',
      patient: {
        id: patient.id,
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
        doctorId: patient.doctorId,
        doctorName: doctor.name,
        doctorPhone: doctor.phone,
        createdAt: patient.createdAt
      },
      whatsappLink: whatsappLink,
              whatsappMessage: `Hola ${name}! 👋 Soy el asistente virtual de Moca. ¿En qué puedo ayudarte hoy?`
    });

  } catch (error) {
    console.error('❌ Patient creation error:', error);
    console.error('🔍 Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('Doctor not found')) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes('already exists')) {
        return res.status(409).json({ error: error.message });
      }
    }
    
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

export default router;
