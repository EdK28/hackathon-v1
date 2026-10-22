import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true },
);

const QuestionSchema = new Schema(
  { text: String, options: [String], multi: Boolean },
  { _id: false },
);

const MessageSchema = new Schema(
  {
    role: { type: String, enum: ['assistant', 'client', 'developer'], required: true },
    text: String,
    question: QuestionSchema, // assistant / developer questions
    answer: { selected: [String], other: String }, // client answers
    kind: String, // 'sketch' = carries a wireframe snapshot; 'chat' = client message after the interview
    wireframe: { type: Schema.Types.Mixed },
    at: { type: Date, default: Date.now },
  },
  { _id: true },
);

const StorySchema = new Schema(
  { asA: String, iWant: String, soThat: String, acceptance: [String] },
  { _id: false },
);

// The brief is plain data so it can be snapshotted into versions and diffed.
const BriefSchema = new Schema(
  {
    fields: { type: Map, of: String, default: {} },
    summary: String,
    stories: [StorySchema],
    risks: [String],
    vague: [{ _id: false, term: String, quote: String, field: String, answer: String, resolved: Boolean }],
    contradictions: [String],
    assumptions: [String],
    openQuestions: [String],
    notes: [String], // answers to questions the developer asked directly
    wireframe: { type: Schema.Types.Mixed }, // { device, screens: [{ name, purpose, blocks: [...] }] }
    wireframeOk: { type: Date, default: null }, // when the client said the sketch looks right
    feedback: [{ _id: false, text: String, at: { type: Date, default: Date.now }, applied: Date }], // client change requests
  },
  { _id: false },
);

const VersionSchema = new Schema(
  {
    n: Number,
    brief: BriefSchema,
    createdAt: { type: Date, default: Date.now },
    note: String,
    signedBy: String,
    signedAt: Date,
  },
  { _id: false },
);

export const STATUSES = ['gathering', 'review', 'awaiting_signoff', 'signed', 'changed'];

const ProjectSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    clientName: { type: String, required: true, trim: true },
    clientEmail: String,
    template: { type: String, required: true },
    initialRequest: String, // the vague request as first received (e.g. pasted from WhatsApp)
    token: { type: String, required: true, unique: true }, // client link secret
    status: { type: String, enum: STATUSES, default: 'gathering', index: true },
    engine: String, // which AI engine is being used
    messages: [MessageSchema],
    // What the last question was about + queued follow-ups (engine bookkeeping)
    pending: { type: Schema.Types.Mixed, default: {} },
    brief: { type: BriefSchema, default: () => ({}) },
    completeness: { type: Number, default: 0 },
    versions: [VersionSchema],
    signedVersion: Number,
  },
  { timestamps: true },
);

export const User = model('User', UserSchema);
export const Project = model('Project', ProjectSchema);
