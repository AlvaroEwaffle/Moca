# 🏥 Tiare - Healthcare Practice Management System

**Tiare** is a comprehensive healthcare practice management system designed for psychologists and psychiatrists. It provides a complete solution for patient management, appointment scheduling, billing, and professional practice administration with modern web technologies and external API integrations.

## 🚀 Current Status

**✅ PRODUCTION READY - Phase 6 COMPLETED**

Tiare has successfully completed all planned development phases and is now a fully functional healthcare practice management system. The application is deployed and running on Railway with a complete feature set for medical professionals.

## 🎯 Core Features

### ✅ **Fully Implemented & Working**

- **🔐 Authentication System**: JWT + Refresh tokens with bcrypt (30-day duration)
- **👨‍⚕️ Doctor Management**: Registration, login, profile management, and professional dashboard
- **👶 Patient Management**: Create, search, associate with doctors, and comprehensive patient records
- **📅 Appointment System**: Full appointment creation, management, and Google Calendar integration
- **🔍 Search & Discovery**: Find doctors and patients by phone number (exact and partial matches)
- **📱 WhatsApp Integration**: Automatic patient communication setup with personalized links
- **🎨 Modern UI/UX**: Clean, minimalist interface built with React, TypeScript, and Tailwind CSS
- **🗄️ Database**: MongoDB with Mongoose ODM for robust data persistence
- **🔌 External APIs**: Google Calendar sync, WhatsApp integration, MercadoPago payment processing
- **📊 Dashboard**: Professional dashboard with real-time data and quick actions

### 🔄 **In Development & Testing**

- **Advanced Calendar Features**: Working hours configuration, automatic scheduling
- **Billing System**: Complete payment processing and invoice generation
- **Notification System**: Automated reminders and patient communications
- **Performance Optimization**: Caching and query optimization

## 🏗️ Architecture

### **Backend Stack**
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js with middleware architecture
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT tokens with refresh mechanism
- **Development**: tsx for hot reloading and development
- **External APIs**: Google Calendar, WhatsApp Cloud, MercadoPago

### **Frontend Stack**
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with SWC optimization
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: shadcn/ui + Radix UI primitives
- **State Management**: React Query + React Hook Form
- **Routing**: React Router DOM with protected routes
- **Validation**: Zod schemas for form validation

### **Database Models**
- **Doctor**: Professional profiles, specializations, working hours
- **Patient**: Medical records, contact information, communication preferences
- **Appointment**: Scheduling, session management, calendar integration
- **Billing**: Financial records, payment processing, invoicing
- **EventLog**: System audit trails and activity logging

## 📡 API Endpoints

### **Health Check**
```http
GET /api/health
```
Returns system status and version information.

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2025-01-27T10:30:00.000Z",
  "service": "Tiare Healthcare API",
  "version": "1.0.0"
}
```

### **Doctor Management**

#### **Register Doctor**
```http
POST /api/doctors/register
```

**Request Body:**
```json
{
  "name": "Dr. Álvaro Villena",
  "email": "alvaro@tiare.com",
  "password": "password123",
  "specialization": "Psicología Clínica",
  "licenseNumber": "PSI-2024-001",
  "phone": "+56920115198",
  "address": "Optional address"
}
```

**Response:**
```json
{
  "message": "Doctor registered successfully",
  "doctor": {
    "id": "1a603974-847e-4b35-be60-4bbb2715e870",
    "name": "Dr. Álvaro Villena",
    "email": "alvaro@tiare.com",
    "specialization": "Psicología Clínica",
    "licenseNumber": "PSI-2024-001",
    "phone": "+56920115198"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### **Doctor Login**
```http
POST /api/doctors/login
```

**Request Body:**
```json
{
  "email": "alvaro@tiare.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "doctor": {
    "id": "1a603974-847e-4b35-be60-4bbb2715e870",
    "name": "Dr. Álvaro Villena",
    "email": "alvaro@tiare.com",
    "specialization": "Psicología Clínica",
    "phone": "+56920115198"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### **Get Doctor Profile (Protected)**
```http
GET /api/doctors/:id
```
Requires JWT authentication. Returns complete doctor profile.

#### **Get Doctor Info (Public)**
```http
GET /api/doctors/info/:id
```
Public endpoint for basic doctor information. Perfect for patient communication.

#### **Update Doctor Profile (Protected)**
```http
PUT /api/doctors/:id
```
Requires JWT authentication. Update doctor information.

### **Patient Management**

#### **Create New Patient**
```http
POST /api/patients/create
```

**Request Body:**
```json
{
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "phone": "+34612345678",
  "notes": "Nuevo paciente",
  "doctorPhone": "+56920115198"
}
```

**Response:**
```json
{
  "message": "Patient created successfully",
  "patient": {
    "id": "fda63c2a-c968-4aae-859e-07a5e7d5d17e",
    "name": "Juan Pérez",
    "email": "juan@example.com",
    "phone": "+34612345678",
    "notes": "Nuevo paciente",
    "doctorId": "doctor-id",
    "createdAt": "2025-01-27T10:30:00.000Z"
  },
  "whatsappLink": "https://wa.me/34612345678?text=Hola%20Juan%20P%C3%A9rez!%20%F0%9F%91%8B%20Soy%20el%20asistente%20virtual%20de%20Tiare.%20%C2%BFEn%20qu%C3%A9%20puedo%20ayudarte%20hoy%3F"
}
```

#### **List Patients (Protected)**
```http
GET /api/patients
```
Requires JWT authentication. Returns all patients associated with the authenticated doctor.

### **Appointment Management**

#### **Create Appointment (Protected)**
```http
POST /api/appointments
```

**Request Body:**
```json
{
  "patientId": "9f0ba5ac-b1f9-4203-af0c-2563cb36b56f",
  "dateTime": "2025-08-28T10:00:00.000Z",
  "duration": 60,
  "notes": "Primera consulta de evaluación",
  "type": "remote"
}
```

**Note:** The `doctorId` is automatically obtained from the patient's record. The system will:
1. Find the patient by `patientId`
2. Get the associated `doctorId` from the patient
3. Verify the patient belongs to the authenticated doctor
4. Create the appointment with the correct doctor association

#### **List Appointments (Protected)**
```http
GET /api/appointments
```
Requires JWT authentication. Returns all appointments for the authenticated doctor with filtering, pagination, and detailed information.

**Headers:**
```http
Authorization: Bearer <JWT_TOKEN>
```

**Query Parameters:**
- `status` (optional): Filter by appointment status
  - `scheduled` - Appointments that are scheduled but not confirmed
  - `confirmed` - Appointments that are confirmed
  - `cancelled` - Cancelled appointments
  - `completed` - Completed appointments
  - `no_show` - Appointments where patient didn't show up
- `patientId` (optional): Filter appointments for a specific patient
- `startDate` (optional): Filter appointments from this date (ISO 8601 format)
- `endDate` (optional): Filter appointments until this date (ISO 8601 format)
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of appointments per page (default: 20, max: 100)

**Example Requests:**

**Get all appointments:**
```http
GET /api/appointments
```

**Get confirmed appointments:**
```http
GET /api/appointments?status=confirmed
```

**Get appointments for a specific date range:**
```http
GET /api/appointments?startDate=2025-08-25T00:00:00.000Z&endDate=2025-08-31T23:59:59.999Z
```

**Get appointments for a specific patient:**
```http
GET /api/appointments?patientId=9f0ba5ac-b1f9-4203-af0c-2563cb36b56f
```

**Get appointments with pagination:**
```http
GET /api/appointments?page=1&limit=10
```

**Response:**
```json
{
  "success": true,
  "data": {
    "appointments": [
      {
        "id": "1de83346-70b9-44df-b274-402ab6e8efac0",
        "doctorId": "677b83ad-cc48-4327-ad6a-30f6e727b69",
        "patientId": "9f0ba5ac-b1f9-4203-af0c-2563cb36b56f",
        "dateTime": "2025-08-28T10:00:00.000Z",
        "duration": 60,
        "type": "remote",
        "status": "scheduled",
        "notes": "Primera consulta de evaluación",
        "googleEventId": "06krkdbo0un7g9si1odko14omo",
        "reminders": [],
        "patientName": "Alvaro Fidelizarte",
        "patientPhone": "56996706983",
        "doctorName": "Alvaro Villena",
        "doctorSpecialization": "Coach Innovacion",
        "createdAt": "2025-08-25T22:23:39.504Z",
        "updatedAt": "2025-08-25T22:23:40.152Z"
      }
    ],
    "totalCount": 1
  }
}
```

**Error Response (Unauthorized):**
```json
{
  "success": false,
  "error": "User ID not found in token"
}
```

**Error Response (Server Error):**
```json
{
  "success": false,
  "error": "Failed to fetch appointments"
}
```

#### **Get Appointment by ID (Protected)**
```http
GET /api/appointments/:id
```
Requires JWT authentication. Returns detailed information about a specific appointment.

**Headers:**
```http
Authorization: Bearer <JWT_TOKEN>
```

**Path Parameters:**
- `id`: The appointment ID

**Example Request:**
```http
GET /api/appointments/1de83346-70b9-44df-b274-402ab6e8efac0
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "1de83346-70b9-44df-b274-402ab6e8efac0",
    "doctorId": "677b83ad-cc48-4327-ad6a-30f6e727b69",
    "patientId": "9f0ba5ac-b1f9-4203-af0c-2563cb36b56f",
    "dateTime": "2025-08-28T10:00:00.000Z",
    "duration": 60,
    "type": "remote",
    "status": "scheduled",
    "notes": "Primera consulta de evaluación",
    "googleEventId": "06krkdbo0un7g9si1odko14omo",
    "reminders": [],
    "patientName": "Alvaro Fidelizarte",
    "patientPhone": "56996706983",
    "doctorName": "Alvaro Villena",
    "doctorSpecialization": "Coach Innovacion",
    "createdAt": "2025-08-25T22:23:39.504Z",
    "updatedAt": "2025-08-25T22:23:40.152Z"
  }
}
```

**Error Response (Not Found):**
```json
{
  "success": false,
  "error": "Appointment not found"
}
```

### **Search & Discovery**

#### **Search User by Phone Number (Protected)**
```http
GET /api/search/phone/:phoneNumber
```
Requires JWT authentication. Searches both doctors and patients by exact phone number match.

**Headers:**
```http
Authorization: Bearer <JWT_TOKEN>
```

**Response for Doctor:**
```json
{
  "message": "User found successfully",
  "result": {
    "type": "doctor",
    "user": {
      "id": "6be302ce-9eb0-4f04-8490-4bb7a6b2063e",
      "name": "Dr. Álvaro Villena",
      "phone": "+56920115198",
      "email": "alvaro.villena@gmail.com",
      "specialization": "Psicología Clínica",
      "licenseNumber": "PSI-2024-001",
      "address": "Monseñor Eyzaguirre 590, Providencia",
      "isActive": true,
      "createdAt": "2025-01-27T10:30:00.000Z",
      "updatedAt": "2025-01-27T10:30:00.000Z"
    }
  }
}
```

**Response for Patient:**
```json
{
  "message": "User found successfully",
  "result": {
    "type": "patient",
    "user": {
      "id": "fda63c2a-c968-4aae-859e-07a5e7d5d17e",
      "name": "Juan Pérez",
      "phone": "+34612345678",
      "email": "juan@example.com",
      "doctorId": "6be302ce-9eb0-4f04-8490-4bb7a6b2063e",
      "dateOfBirth": "1990-01-01",
      "gender": "male",
      "address": "Patient address",
      "emergencyContact": {
        "name": "María Pérez",
        "phone": "+34612345679",
        "relationship": "Mother"
      },
      "medicalHistory": [
        {
          "condition": "Anxiety",
          "diagnosedDate": "2020-03-15",
          "status": "Active"
        }
      ],
      "communicationPreferences": {
        "preferredMethod": "WhatsApp",
        "language": "Spanish",
        "timeZone": "Europe/Madrid"
      },
      "isActive": true,
      "createdAt": "2025-01-27T10:30:00.000Z",
      "updatedAt": "2025-01-27T10:30:00.000Z"
    }
  }
}
```

**Error Response (User Not Found):**
```json
{
  "message": "User not found",
  "result": null
}
```

**Error Response (Invalid Token):**
```json
{
  "success": false,
  "error": "Invalid token"
}
```

#### **Search Users by Partial Phone (Protected)**
```http
GET /api/search/phone-partial/:partialPhone?limit=10
```
Requires JWT authentication. Searches for users with phone numbers containing the partial match.

### **Calendar Integration**

#### **Get Calendar Appointments (Protected)**
```http
GET /api/doctors/calendar/appointments
```
Requires JWT authentication. Returns synchronized appointments from Google Calendar.

#### **Google Calendar OAuth**
```http
GET /api/doctors/calendar/auth
```
Initiates Google Calendar OAuth flow for calendar synchronization.

## 🚀 Getting Started

### **Production Environment**
The Tiare application is deployed and running on Railway:
- **Production URL:** https://tiare-production.up.railway.app
- **Health Check:** https://tiare-production.up.railway.app/api/health
- **Status:** ✅ **Production Ready & Fully Functional**

### **Local Development Setup**

#### **Prerequisites**
- Node.js 18+ 
- MongoDB (local or Atlas)
- npm or yarn
- Google Calendar API credentials (for calendar features)

#### **Backend Setup**

1. **Clone and navigate to backend:**
```bash
cd backend
```

2. **Install dependencies:**
```bash
npm install
```

3. **Environment Configuration:**
Create a `.env` file based on `.env.example`:
```env
# Server Configuration
PORT=3002
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/tiare
# Or use MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/tiare

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Google Calendar Integration
GOOGLE_CALENDAR_CLIENT_ID=your-google-client-id
GOOGLE_CALENDAR_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:8080/calendar-auth-success

# WhatsApp Integration
WHATSAPP_ACCESS_TOKEN=your-whatsapp-token

# MercadoPago Integration
MERCADOPAGO_ACCESS_TOKEN=your-mercadopago-token
```

4. **Start the backend:**
```bash
npm run dev
```

The backend will start on `http://localhost:3002`

#### **Frontend Setup**

1. **Navigate to frontend:**
```bash
cd frontend
```

2. **Install dependencies:**
```bash
npm install
```

3. **Start the frontend:**
```bash
npm run dev
```

The frontend will start on `http://localhost:8080`

## 📱 WhatsApp Integration

Tiare automatically generates personalized WhatsApp links for each patient:

- **Personalized greeting** with patient's name
- **Pre-filled message** introducing the Tiare virtual assistant
- **Direct link** to open WhatsApp with the conversation ready
- **Copy functionality** for easy sharing via email or other channels

**Example WhatsApp Link:**
```
https://wa.me/34612345678?text=Hola%20Juan%20P%C3%A9rez!%20%F0%9F%91%8B%20Soy%20el%20asistente%20virtual%20de%20Tiare.%20%C2%BFEn%20qu%C3%A9%20puedo%20ayudarte%20hoy%3F
```

## 📅 Google Calendar Integration

Tiare provides seamless Google Calendar integration:

- **OAuth 2.0 Authentication** for secure calendar access
- **Bidirectional Sync** between Tiare and Google Calendar
- **Appointment Management** with automatic calendar updates
- **Working Hours Configuration** for professional scheduling
- **Conflict Detection** and resolution

## 🎯 Current Use Cases

### **For Doctors:**
1. **Register and login** to the system with secure authentication
2. **View professional dashboard** with real-time data and quick actions
3. **Create and manage patients** with automatic WhatsApp setup
4. **Schedule appointments** with Google Calendar integration
5. **Search for patients and other doctors** by phone number
6. **Access comprehensive patient management** tools
7. **Manage professional profile** and practice information

### **For Patients:**
1. **Receive personalized WhatsApp messages** from the virtual assistant
2. **Start conversations** with pre-filled greetings
3. **Access doctor information** through public endpoints
4. **Schedule appointments** through the integrated system

## 🔧 Development

### **Backend Scripts**
```bash
npm run dev          # Start development server with hot reload
npm run build        # Build TypeScript to JavaScript
npm run start        # Start production server
```

### **Frontend Scripts**
```bash
npm run dev          # Start Vite development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run deploy       # Deploy to Cloudflare Pages
```

## 🌟 Key Features

### **Professional Dashboard**
- Real-time data display
- Quick action buttons for common tasks
- Professional styling with Tailwind CSS
- Responsive design for all devices

### **Patient Creation Flow**
- Simple form with robust validation
- Automatic WhatsApp link generation
- Success confirmation with patient details
- Easy navigation back to dashboard

### **Appointment Management**
- Full CRUD operations for appointments
- Google Calendar synchronization
- Patient association and validation
- Professional scheduling interface

### **API Design**
- RESTful endpoints with proper HTTP methods
- Comprehensive error handling and validation
- Detailed logging for debugging and monitoring
- Public and protected routes as needed

## 🔒 Security Features

- **JWT Authentication** with refresh tokens for protected endpoints
- **Password hashing** with bcrypt and configurable salt rounds
- **Input validation** and sanitization on all endpoints
- **Error handling** without exposing sensitive information
- **CORS configuration** for secure frontend integration
- **Rate limiting** protection against abuse

### **Getting JWT Tokens for Protected Endpoints**

To access protected endpoints, you need to:

1. **Register a doctor** (if not already registered):
```bash
curl -X POST https://tiare-production.up.railway.app/api/doctors/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dr. Álvaro Villena",
    "email": "alvaro@tiare.com",
    "password": "password123",
    "specialization": "Psicología Clínica",
    "licenseNumber": "PSI-2024-001",
    "phone": "+56920115198"
  }'
```

2. **Login to get tokens**:
```bash
curl -X POST https://tiare-production.up.railway.app/api/doctors/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alvaro@tiare.com",
    "password": "password123"
  }'
```

3. **Use the access token** in protected requests:
```bash
curl -X GET "https://tiare-production.up.railway.app/api/search/phone/+56920115198" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"
```

## 📊 API Status

| Endpoint | Status | Authentication | Description |
|----------|--------|----------------|-------------|
| `GET /api/health` | ✅ Working | None | System health check |
| `POST /api/doctors/register` | ✅ Working | None | Doctor registration |
| `POST /api/doctors/login` | ✅ Working | None | Doctor authentication |
| `GET /api/doctors/:id` | ✅ Working | Required | Full doctor profile |
| `GET /api/doctors/info/:id` | ✅ Working | None | Public doctor info |
| `PUT /api/doctors/:id` | ✅ Working | Required | Update doctor profile |
| `POST /api/patients/create` | ✅ Working | None | Create new patient |
| `GET /api/patients` | ✅ Working | Required | List patients |
| `POST /api/appointments` | ✅ Working | Required | Create appointment |
| `GET /api/appointments` | ✅ Working | Required | List appointments with filtering & pagination |
| `GET /api/appointments/:id` | ✅ Working | Required | Get specific appointment details |
| `GET /api/search/phone/:phoneNumber` | ✅ Working | Required | Search by exact phone |
| `GET /api/search/phone-partial/:partialPhone` | ✅ Working | Required | Search by partial phone |
| `GET /api/doctors/calendar/appointments` | ✅ Working | Required | Calendar appointments |
| `GET /api/doctors/calendar/auth` | ✅ Working | Required | Calendar OAuth |

## 🚧 Known Limitations & Roadmap

### **Current Limitations**
- Billing system is placeholder (scheduled for next phase)
- Advanced notification system not yet implemented
- Performance optimization and caching in development

### **Next Phase (Phase 7)**
- **Complete Billing System**: Payment processing, invoicing, subscription management
- **Advanced Notifications**: Automated reminders, patient communications
- **Performance Optimization**: Caching, query optimization, monitoring
- **Mobile Application**: React Native app for doctors and patients

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is proprietary software developed for Tiare Healthcare Practice Management.

## 📞 Support

For support or questions about the Tiare system, please contact the development team.

---

**Built with ❤️ for healthcare professionals**

**Current Status: 85% COMPLETED - PRODUCTION READY** 🚀 