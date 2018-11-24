'use strict';

const express = require('express');
const db = require('./dynamo');

const router = express.Router();

const MONEY_NOT_ENOUGH = 911
const TAG_DOES_NOT_EXIST = 922;
const WEIRD_ERROR = 999;

router.post('/pay', async (req, res) => {
  const { body } = req;

  return db.getTag(body.tag_number)
    .then(async (tag) => {
      if (!tag) {
        return res.status(404).json({
          cup_code: TAG_DOES_NOT_EXIST,
          error: 'Tag does not exist',
        });
      }
      console.log('Tag found', tag);
      const accountId = tag.account_id;

      let servo;
      let productId;
      if (body.product_id) {
        productId = body.product_id;
        servo = 'servo_01';
      } else {
        const picketProduct = await db.pickProductForTag(tag, body.products);
        productId = picketProduct.id;
        servo = picketProduct.servo;
      }

      return db.makePurchase(accountId, productId)
        .then((result) => {
          console.log('Purchase response: ', result);
          if (!result.success) {
            return res.status(404).json({
              cup_code: MONEY_NOT_ENOUGH,
              error: 'Not enough money',
            });
          }

          return res.json({
            balance: result.data,
            servo,
          });
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
