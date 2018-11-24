'use strict';

const express = require('express');
const db = require('./dynamo');

const router = express.Router();

router.param('accountId', (req, res, next, accountId) => {
  console.log(`Searching for account with id ${accountId}`);

  return db.getAccount(accountId)
    .then((account) => {
      console.log('Account found', account);
      if (!account) {
        return res.status(404).json({ error: 'Invalid account'});
      }

      req.account = account;
      next();
    })
    .catch((err) => {
      console.log('Error when searching account', err);
      
      return res.status(500).json({ error: 'Something weird happened' });
    })
});

router.post('/:accountId/tags', (req, res) => {
  const { body: { name, tag_number } } = req;

  const tagParams = {
    name,
    tag_number,
    account_id: req.account.account_id,
  };

  console.log('Tag params to create', tagParams);

  return db.createTag(tagParams)
    .then((result) => {
      console.log('Result from creating tag', result);
      if (!result.success) {
        return res.status(409).json({ error: 'Tag already exists' });
      }

      return res.json(result.data);
    })
    .catch((err) => {
      console.log({ err }, 'Failed to create newtag');

      return res.status(400).json(formatError('Failed to create tag', err));
    });
});

router.get('/:accountId/tags', (req, res) => {
  return db.getTags(req.account.account_id)
    .then((tags) => res.json({ tags })) // Empty result when success
    .catch((err) => {
      console.log({ err }, 'Failed to create newtag');

      return res.status(400).json(formatError('Failed to create tag', err));
    });
});

router.delete('/:accountId/tags/:tagNumber', (req, res) => {
  const tagNumber = req.params.tagNumber;
  console.log(`Deleting tag ${tagNumber}`);

  return db.deleteTag(req.account.account_id, tagNumber)
    .then((result) => {
      if (result.success) {
        return res.json({});
      }

      return res.status(result.code || 400)
        .json({ error: result.error });
    });
});

router.get('/:accountId/payments', (req, res) => {
  console.log('Getting payments');

  return db.getPayments(req.account.account_id)
    .then(payments => res.json({
      payments,
      balance: req.account.balance,
    }))
    .catch((err) => {
      console.log('Failed to get payments', err);

      return res.status(500).json({ error: 'Some weird error happened' });
    });
});

module.exports = router;