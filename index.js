const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

admin.initializeApp();

const app = express();

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({ origin: true }));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'firebase-functions-api'
  });
});

// User routes
app.get('/users', async (req, res) => {
  try {
    const usersSnapshot = await admin.firestore().collection('users').limit(50).get();
    const users = [];

    usersSnapshot.forEach(doc => {
      users.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/users', async (req, res) => {
  try {
    const { name, email, role = 'user' } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const userData = {
      name,
      email,
      role,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await admin.firestore().collection('users').add(userData);

    res.status(201).json({
      id: docRef.id,
      ...userData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await admin.firestore().collection('users').doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: doc.id,
      ...doc.data()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Todo routes
app.get('/todos', async (req, res) => {
  try {
    const todosSnapshot = await admin.firestore().collection('todos').limit(50).get();
    const todos = [];

    todosSnapshot.forEach(doc => {
      todos.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({ todos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/todos', async (req, res) => {
  try {
    const { title, description, completed = false } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const todoData = {
      title,
      description,
      completed,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await admin.firestore().collection('todos').add(todoData);

    res.status(201).json({
      id: docRef.id,
      ...todoData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/todos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, completed } = req.body;

    const updateData = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (completed !== undefined) updateData.completed = completed;

    await admin.firestore().collection('todos').doc(id).update(updateData);

    const updatedDoc = await admin.firestore().collection('todos').doc(id).get();

    res.json({
      id: updatedDoc.id,
      ...updatedDoc.data()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/todos/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await admin.firestore().collection('todos').doc(id).delete();

    res.json({ message: 'Todo deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export the Express app as a Firebase Function
exports.api = functions.https.onRequest(app);

// Additional functions
exports.createUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { email, displayName } = data;

  try {
    const user = await admin.auth().createUser({
      email,
      displayName,
      emailVerified: false
    });

    return { uid: user.uid, email: user.email };
  } catch (error) {
    throw new functions.https.HttpsError('internal', error.message);
  }
});

exports.sendNotification = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { token, title, body } = data;

  try {
    const message = {
      token,
      notification: {
        title,
        body
      }
    };

    const response = await admin.messaging().send(message);
    return { success: true, messageId: response };
  } catch (error) {
    throw new functions.https.HttpsError('internal', error.message);
  }
});