const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/members', require('./routes/members'));
app.use('/api/bills', require('./routes/bills'));
app.use('/api/tracking', require('./routes/tracking'));
app.use('/api/settlements', require('./routes/settlements'));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Ghazal running at http://localhost:${PORT}`);
});
