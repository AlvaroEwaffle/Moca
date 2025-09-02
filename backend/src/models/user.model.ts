import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  id: string;
  name: string;
  email: string;
  password: string;
  businessName: string;
  phone: string;
  avatar?: string;
  specialization?: string;
  isActive: boolean;
  emailVerified: boolean;
  lastLogin?: Date;
  preferences: {
    language: string;
    timezone: string;
    notifications: {
      email: boolean;
      push: boolean;
    };
  };
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    loginCount: number;
  };
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  businessName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  avatar: { type: String, required: false },
  specialization: { type: String, required: false, default: 'Business Owner' },
  isActive: { type: Boolean, default: true },
  emailVerified: { type: Boolean, default: false },
  lastLogin: { type: Date, required: false },
  preferences: {
    language: { type: String, default: 'es' },
    timezone: { type: String, default: 'America/Santiago' },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    }
  },
  metadata: {
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
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

// Pre-save middleware to update metadata
UserSchema.pre('save', function(next) {
  this.metadata.updatedAt = new Date();
  next();
});

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
