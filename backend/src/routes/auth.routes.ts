import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user!.userId).lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Remove sensitive fields
    const { password, ...safeUser } = user as any;

    res.json({
      success: true,
      data: safeUser
    });
  } catch (error) {
    console.error('❌ Error fetching current user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch current user'
    });
  }
});

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, businessName, phone, agentSettings } = req.body;

    // Validate required fields
    if (!name || !email || !password || !businessName || !phone) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'User already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user in MongoDB
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      businessName,
      phone,
      agentSettings: {
        systemPrompt: agentSettings?.systemPrompt || 'You are a helpful customer service assistant for a business. Respond to customer inquiries professionally and helpfully.',
        toneOfVoice: agentSettings?.toneOfVoice || 'professional',
        keyInformation: agentSettings?.keyInformation || ''
      }
    });

    await newUser.save();

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '24h' }
    );

    const refreshToken = jwt.sign(
      { userId: newUser.id },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    console.log(`✅ User registered: ${email}`);

    // Remove password from response
    const userResponse = newUser.toObject();
    delete (userResponse as any).password;

    res.status(201).json({
      success: true,
      data: {
        message: 'User registered successfully',
        user: userResponse,
        tokens: {
          accessToken,
          refreshToken
        }
      }
    });

  } catch (error) {
    console.error('❌ Error in registration:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed'
    });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Find user in MongoDB
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '24h' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    // Update login tracking
    user.metadata.loginCount += 1;
    user.lastLogin = new Date();
    await user.save();

    console.log(`✅ User logged in: ${email}`);

    // Remove password from response
    const userResponse = user.toObject();
    delete (userResponse as any).password;

    res.json({
      success: true,
      data: {
        message: 'Login successful',
        user: userResponse,
        tokens: {
          accessToken,
          refreshToken
        }
      }
    });

  } catch (error) {
    console.error('❌ Error in login:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

// Update user agent settings
router.put('/update-agent-settings', authenticateToken, async (req, res) => {
  try {
    const { agentSettings } = req.body;
    const userId = req.user!.userId;

    if (!agentSettings) {
      return res.status(400).json({
        success: false,
        error: 'Agent settings are required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Update agent settings
    user.agentSettings = {
      systemPrompt: agentSettings.systemPrompt || user.agentSettings.systemPrompt,
      toneOfVoice: agentSettings.toneOfVoice || user.agentSettings.toneOfVoice,
      keyInformation: agentSettings.keyInformation || user.agentSettings.keyInformation
    };

    await user.save();

    console.log(`✅ Updated agent settings for user: ${user.email}`);

    res.json({
      success: true,
      data: {
        message: 'Agent settings updated successfully',
        agentSettings: user.agentSettings
      }
    });

  } catch (error) {
    console.error('❌ Error updating agent settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update agent settings'
    });
  }
});

export default router;
