const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const { router: authRouter, requireAuth } = require('./routes/auth');

app.use('/api/auth', authRouter);
app.use('/api/members', require('./routes/members')); // public — just names, auth handles finances
app.use('/api/bills', requireAuth, require('./routes/bills'));
app.use('/api/tracking', requireAuth, require('./routes/tracking'));
app.use('/api/settlements', requireAuth, require('./routes/settlements'));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Ghazal running at http://localhost:${PORT}`);
});
