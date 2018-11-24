'use strict';

const AWS = require('aws-sdk');
const bcrypt = require('bcryptjs');
const uuidv4 = require('uuid/v4');

AWS.config.update({
  region: 'eu-central-1',
});

const docClient = new AWS.DynamoDB.DocumentClient();

const SALT_ROUNDS = 10;

const tables = {
  account: 'ccg-accounts',
  tags: 'ccg-tags',
  products: 'ccg-products',
  payments: 'ccg-payments',
};

const getAccountByEmail = (email) => {
  const queryParams = {
    TableName: tables.account,
    Key: { email },
  };

  return docClient.get(queryParams).promise()
    .then(res => res.Item);
}

/**
 * @param {Object} params
 */
const createAccount = async (params) => {
  const account = await getAccountByEmail(params.email);

  if (account) {
    return { conflict: true };
  }

  const salt = await bcrypt.genSalt(SALT_ROUNDS);

  return bcrypt.hash(params.password, salt)
    .then((password) => {
      const accountId = uuidv4();
      const queryParams = {
        TableName: tables.account,
        Item: {
          password,
          email: params.email,
          account_id: accountId,
          customer_id: params.customer_id || '844D1532074B04',
          balance: "1000",
        },
      };

      return docClient.put(queryParams).promise()
        .then(() => ({ data: accountId }));
    });
};

const getAccount = (accountId) => {
  const queryParams = {
    TableName: tables.account,
    IndexName: 'account_id',
    Key: { account_id: accountId },
    KeyConditionExpression: 'account_id = :account_id',
    ExpressionAttributeValues: { ':account_id': accountId },
  };

  return docClient.query(queryParams).promise()
    .then((result) => {
      if (result && result.Items && result.Items.length > 0) {
        return result.Items[0];
      }

      return null;
    })
};

const login = (params) => {
  return getAccountByEmail(params.email)
    .then((account) => {
      console.log('Result returned by login', account);
      if (!account) {
        return {
          success: false,
          error: 'Account does not exist',
        };
      }

      return bcrypt.compare(params.password, account.password)
        .then((samePassword) => {
          if (!samePassword) {
            console.log('Wrong password attempt');

            return {
              success: false,
              error: 'Wrong password',
            };
          }

          return {
            success: true,
            data: account.account_id,
          };
        })
    })
};

/**
 * Creates a tag and returns a promise.
 * @param {Object} params
 */
const createTag = async (params) => {
  const tag = await getTag(params.tag_number);
  console.log('This is tag', tag);

  if (tag) {
    return { success: false };
  }

  const queryParams = {
    TableName: tables.tags,
    Item: params,
  };

  return docClient.put(queryParams).promise()
    .then(res => ({ success: true, data: res}));
};

/**
 * Returns list of tags for a specific account
 * @param {String} accountId
 */
const getTags = (accountId) => {
  const queryParams = {
    TableName: tables.tags,
    Key: { account_id: accountId },
    KeyConditionExpression: 'account_id = :account_id',
    ExpressionAttributeValues: { ':account_id': accountId },
  };

  return docClient.query(queryParams).promise()
    .then((result) => result.Items || []);
};

/**
 * Deletes a tag and returns a Promise.
 *
 * @param {String} accountId
 * @param {String} tagNumber
 */
const deleteTag = (accountId, tagNumber) => {
  return getTag(tagNumber)
    .then((tag) => {
      if (!tag) {
        return {
          success: false,
          error: 'Tag does not exist',
          code: 404,
        };
      }

      const queryParams = {
        TableName: tables.tags,
        Key: {
          account_id: accountId,
          tag_number: tagNumber,
        },
      };
    
      return docClient.delete(queryParams).promise()
        .then(() => ({ success: true }))
        .catch((err) => {
          console.log('Failed to delete tag', err);

          return {
            success: false,
            error: 'Failed to delete tag',
          };
        });
    });
};

const getTag = (tagNumber) => {
  const queryParams = {
    TableName: tables.tags,
    IndexName: 'tag_number',
    Key: { tag_number: tagNumber },
    KeyConditionExpression: 'tag_number = :tag_number',
    ExpressionAttributeValues: { ':tag_number': tagNumber },
  };

  return docClient.query(queryParams).promise()
    .then((result) => {
      console.log('Results from getTag', result);
      if (result && result.Items && result.Items.length > 0) {
        return result.Items[0];
      }
      
      return null;
    })
};

const getProduct = (productId) => {
  const queryParams = {
    TableName: tables.products,
    Key: { product_id: productId },
  };

  return docClient.get(queryParams).promise()
    .then(res => res.Item);
};

const makePurchase = async (accountId, productId) => {
  const product = await getProduct(productId);
  const account = await getAccount(accountId);

  const balance = parseInt(account.balance || 0, '10');
  const price = parseInt(product.price, 10);

  if (balance < price) {
    return { success: false };
  }

  const putParams = {
    TableName: tables.payments,
    Item: {
      date:(new Date()).toISOString(),
      account_id: accountId,
      product_id: productId,
      price,
      product_name: product.name,
      type: product.type,
    },
  };

  await docClient.put(putParams).promise();

  const updateParams = {
    TableName: tables.account,
    Key: { email: account.email },
    UpdateExpression: "set balance = :balance",
    ExpressionAttributeValues:{
        ":balance": balance - price,
    },
    ReturnValues:"UPDATED_NEW"
  };

  const response = await docClient.update(updateParams).promise();

  return {
    success: true,
    data: response.Attributes.balance,
  };
};

const getPayments = (accountId) => {
  const queryParams = {
    TableName: tables.payments,
    Key: { account_id: accountId },
    KeyConditionExpression: 'account_id = :account_id',
    ExpressionAttributeValues: { ':account_id': accountId },
    Limit: 3,
    ScanIndexForward: false,
  };

  return docClient.query(queryParams).promise()
    .then((result) => result.Items || []);
};

/**
 * 
 * @param {Object} tag
 * @param {Object} products - Object where keys are product_id and values are servo ids
 */
const pickProductForTag = (tag, productServos) => {
  if (!tag.preference) {
      // If tag has no preference, return the first one
    return {
      id: Object.keys(productServos)[0],
      servo: Object.values(productServos)[0],
    };
  }

  // Prepare batchGet params
  const productKeys = Object.keys(productServos).map(productId => ({ product_id: productId}));

  const batchParams = {
    RequestItems: {
      [tables.products]: {
        Keys: productKeys,
      }
    },
  };

  return docClient.batchGet(batchParams).promise()
    .then((result) => {
      const products = result.Responses[tables.products] || [];
      const preferedProducts = products.filter(product => product.type === tag.preference)
        .map((product) => ({
          id: product.product_id,
          servo: productServos[product.product_id],
        }));
      
      console.log('All prefered products', preferedProducts);

      // If nothing found, return the first one
      if (!preferedProducts.length) {
        return {
          id: Object.keys(productServos)[0],
          servo: Object.values(productServos)[0],
        };
      }

      return preferedProducts[0];
    })
    .catch((err) => {
      console.log('Failed to batch get', err);
    })
};

module.exports = {
  tables,
  createAccount,
  login,
  getAccount,
  createTag,
  getTags,
  getTag,
  deleteTag,
  makePurchase,
  getPayments,
  pickProductForTag,
};
