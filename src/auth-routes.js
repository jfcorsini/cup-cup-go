'use strict';

const express = require('express');
const db = require('./dynamo');

const router = express.Router();

const formatError = (message, err) => ({
  message,
  error: err.message,
  stack: err.stack,
});

router.post('/register', (req, res) => {
  const { body } = req;

  return db.createAccount(body)
    .then((result) => {
      if (result.conflict) {
        return res.status(409).json({
          error: 'User already exists',
        });
      }

      return res.json({ accountId: result.data});
    })
    .catch((err) => {
      console.log({ err }, 'Failed to register new account');

      return res.status(400).json(formatError('Could not register', err));
    });
});

router.post('/login', (req, res) => {
  const { body } = req;
  console.log(`Trying to login with parameters: ${body}`);

  return db.login(body)
    .then((result) => {
      if (result.success) {
        return res.status(200).json({ accountId: result.data });
      }

      return res.status(404).json({
        error: result.error,
      });
    })
    .catch((err) => {
      console.log({ err }, 'Failed to login new account');

      return res.status(400).json(formatError('Could not login', err));
    });
});

module.exports = router;
