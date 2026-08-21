const mongoose = require('mongoose');
const crypto = require('crypto');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ghazal';

const memberSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  created_at: { type: Date, default: Date.now }
});

const authSchema = new mongoose.Schema({
  member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  token: { type: String, default: null },
  isAdmin: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});
authSchema.index({ member_id: 1 }, { unique: true, sparse: true });

const billSchema = new mongoose.Schema({
  type: { type: String, required: true },
  description: { type: String, default: '' },
  total_amount: { type: Number, required: true },
  paid_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
  date: { type: String, default: () => new Date().toISOString().split('T')[0] },
  items: [{ name: String, quantity: Number, unit: String, amount: Number }],
  splits: [{ member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' }, amount: Number }],
  created_at: { type: Date, default: Date.now }
});

const trackedItemSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  unit: { type: String, default: 'pieces' },
  price_per_unit: { type: Number, default: 0 }
});

const trackedLogSchema = new mongoose.Schema({
  item_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TrackedItem', required: true },
  action: { type: String, required: true },
  quantity: { type: Number, required: true },
  member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null },
  paid_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null },
  split_members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }],
  price_per_unit: { type: Number, default: null },
  notes: { type: String, default: null },
  date: { type: String, default: () => new Date().toISOString().split('T')[0] },
  created_at: { type: Date, default: Date.now }
});

const settlementSchema = new mongoose.Schema({
  from_member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
  to_member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
  amount: { type: Number, required: true },
  date: { type: String, default: () => new Date().toISOString().split('T')[0] },
  notes: { type: String, default: null },
  created_at: { type: Date, default: Date.now }
});

const Member = mongoose.model('Member', memberSchema);
const Auth = mongoose.model('Auth', authSchema);
const Bill = mongoose.model('Bill', billSchema);
const TrackedItem = mongoose.model('TrackedItem', trackedItemSchema);
const TrackedLog = mongoose.model('TrackedLog', trackedLogSchema);
const Settlement = mongoose.model('Settlement', settlementSchema);

function hashPwd(pwd) {
  return crypto.createHash('sha256').update(pwd + 'ghazal-south11-2024').digest('hex');
}

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('MongoDB connected');
    const admin = await Auth.findOne({ isAdmin: true });
    if (!admin) {
      await Auth.create({ username: 'admin', password: hashPwd('admin123'), isAdmin: true });
      console.log('Admin account created (admin / admin123)');
    }
    const eggs = await TrackedItem.findOne({ name: 'Eggs' });
    if (!eggs) {
      await TrackedItem.create({ name: 'Eggs', unit: 'pieces', price_per_unit: 0 });
      console.log('Default item "Eggs" created');
    }
  })
  .catch(e => { console.error('MongoDB error:', e.message); process.exit(1); });

module.exports = { Member, Auth, Bill, TrackedItem, TrackedLog, Settlement };
