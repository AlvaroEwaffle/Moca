import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  id: string;
  name: string;
  email: string;
  password: string;
  businessName: string;
  phone: string;
  isActive: boolean;
  lastLogin?: Date;
  preferences: any; // Flexible object
  agentSettings: {
    systemPrompt: string;
    toneOfVoice: 'professional' | 'friendly' | 'casual';
    keyInformation: string;
  };
  metadata: {
    loginCount: number;
  };
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  businessName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date, required: false },
  preferences: { type: Schema.Types.Mixed, default: {} },
  agentSettings: {
    systemPrompt: { type: String, default: 'You are a helpful customer service assistant for a business. Respond to customer inquiries professionally and helpfully.' },
    toneOfVoice: { type: String, enum: ['professional', 'friendly', 'casual'], default: 'professional' },
    keyInformation: { type: String, default: '' }
  },
  metadata: {
    loginCount: { type: Number, default: 0 }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance (email already has unique index from schema definition)
UserSchema.index({ isActive: 1 });
UserSchema.index({ 'metadata.createdAt': 1 });

// No pre-save middleware needed

// Virtual for user display name
UserSchema.virtual('displayName').get(function() {
  return this.name || this.businessName || this.email;
});

// Method to increment login count
UserSchema.methods.incrementLoginCount = function() {
  this.metadata.loginCount += 1;
  this.lastLogin = new Date();
  return this.save();
};

// Method to get user without password
UserSchema.methods.toSafeObject = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

export default mongoose.model<IUser>('User', UserSchema);
