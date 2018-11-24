'use strict';

const express = require('express');
const db = require('./dynamo');

const router = express.Router();

const MONEY_NOT_ENOUGH = 911
const TAG_DOES_NOT_EXIST = 922;
const WEIRD_ERROR = 999;

router.post('/pay', (req, res) => {
  const { body: {tag_number: number, product_id: productId } } = req;

  return db.getAccountByTagNumber(number)
    .then((result) => {
      if (!result.success) {
        return res.status(404).json({
          cup_code: TAG_DOES_NOT_EXIST,
          error: 'Tag does not exist',
        });
      }
      console.log('Account found', result.data);
      const accountId = result.data.account_id;

      return db.makePurchase(accountId, productId)
        .then((result) => {
          console.log('Purchase response: ', result);
          if (!result.success) {
            return res.status(404).json({
              cup_code: MONEY_NOT_ENOUGH,
              error: 'Not enough money',
            });
          }

          return res.json(result.data);
        })
    })
    .catch((err) => {
      console.log('Weird error when paying', err);
      return res.status(500).json({
        cup_code: WEIRD_ERROR,
        error: 'Something bad happened',
      });
    });
});

module.exports = router;
