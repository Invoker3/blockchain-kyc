const express = require('express')
const app = express()
const bodyParser = require('body-parser');
const Blockchain = require('./blockchain');
const uuid = require('uuid/v1');
const port = process.argv[2];
const rp = require('request-promise');
const crypto = require('crypto');
const fs = require('fs');
const PromiseA = require('bluebird').Promise;
const fsPromise = PromiseA.promisifyAll(require('fs'));
const path = require('path');
const ursa = require('ursa');
const mkdirpAsync = PromiseA.promisify(require('mkdirp'));

const nodeAddress = uuid().split('-').join('');

const bitcoin = new Blockchain();

var gov = {
    public_key: fs.readFileSync('gov/pubkey.pem'),
    private_key: fs.readFileSync('gov/privkey.pem')
}
var anuj = {
    public_key: fs.readFileSync('anuj/pubkey.pem'),
    private_key: fs.readFileSync('anuj/privkey.pem')
}
var zoomcar = {
    public_key: fs.readFileSync('zoomcar/pubkey.pem'),
    private_key: fs.readFileSync('zoomcar/privkey.pem')
}
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('dev/client'));

app.get('/blockchain', function (req, res) {
    res.send(bitcoin);

})

app.post('/transaction', function (req, res) {
    const newTransaction = req.body;
    const blockIndex = bitcoin.addTransactionToPendingTransactions(newTransaction);
    res.json({ note: `Transaction will be added in block ${blockIndex}.` });
})

app.post('/generate-keypair', function (req, res) {
    const keyName = req.body.keyName;
    function keypair(pathname) {
        var key = ursa.generatePrivateKey(1024, 65537);
        var privpem = key.toPrivatePem();
        var pubpem = key.toPublicPem();
        var privkey = path.join('keys', pathname, pathname + '.privkey.pem');
        var pubkey = path.join('keys', pathname, pathname + '.pubkey.pem');
      
        return mkdirpAsync('keys/' + pathname).then(function () {
          return PromiseA.all([
            fsPromise.writeFileAsync(privkey, privpem, 'ascii')
          , fsPromise.writeFileAsync(pubkey, pubpem, 'ascii')
          ]);
        }).then(function () {
          return key;
        });
      }
      
      PromiseA.all([
        keypair(keyName)
      ]).then(function (keys) {
        res.json({note: 'Public/Private keypair generated for ' + keyName});
      });
})

app.post('/input-and-encrypt', function (req, res) {
    const name = req.body.name;
    const age = req.body.age;
    const gender = req.body.gender;
    const license = req.body.license;

    var first_result = crypto.privateEncrypt({
        key: gov.private_key
    }, new Buffer(JSON.stringify(req.body)));

    var second_result = crypto.publicEncrypt({
        key: anuj.public_key,
        padding: crypto.constants.RSA_NO_PADDING
    }, first_result);

    var encryptedData = second_result.toString('hex');
    const requestOptions = {
        uri: bitcoin.currentNodeUrl + '/transaction/broadcast',
        method: 'POST',
        body: { encryptedData: encryptedData },
        json: true
    };
    rp(requestOptions)
        .then(data => {
            res.json({ encryptedData: encryptedData })
        })
})


app.post('/encrypt-and-share', function (req, res) {
    var new_second_result = new Buffer(req.body.encryptedData, "hex");

    var second_plaintext = crypto.privateDecrypt({
        key: anuj.private_key,
        padding: crypto.constants.RSA_NO_PADDING
    }, new_second_result);

    var second_result = crypto.publicEncrypt({
        key: zoomcar.public_key,
        padding: crypto.constants.RSA_NO_PADDING
    }, second_plaintext);

    var encryptedData = second_result.toString('hex');
    res.json({encryptedData: encryptedData});
   
})

app.post('/decrypt-and-output',function(req, res) {
    var second_result = new Buffer(req.body.encryptedData, "hex");

    var second_plaintext = crypto.privateDecrypt({
        key: zoomcar.private_key,
        padding: crypto.constants.RSA_NO_PADDING
    }, second_result);
    console.log(second_plaintext.toString("hex"));

    var first_plaintext = crypto.publicDecrypt({
        key: gov.public_key
    }, second_plaintext);

    var decryptedData = JSON.parse(first_plaintext.toString('utf8'));
    res.json({decryptedData: decryptedData});


})


app.post('/transaction/broadcast', function (req, res) {
    const newTransaction = bitcoin.createNewTransaction(req.body.encryptedData);
    bitcoin.addTransactionToPendingTransactions(newTransaction);

    const requestPromises = [];
    bitcoin.networkNodes.forEach(networkNodeUrl => {
        const requestOptions = {
            uri: networkNodeUrl + '/transaction',
            method: 'POST',
            body: newTransaction,
            json: true
        };

        requestPromises.push(rp(requestOptions));
    });

    Promise.all(requestPromises)
        .then(data => {
            res.json({ note: 'Transaction created and broadcasted successfully.' })
        })
})

app.get('/mine', function (req, res) {
    const lastBlock = bitcoin.getLastBlock();
    const previousBlockHash = lastBlock['hash'];
    const currentBlockData = {
        transactions: bitcoin.pendingTransactions,
        index: lastBlock['index'] + 1
    };
    const nonce = bitcoin.proofOfWork(previousBlockHash, currentBlockData);
    const blockHash = bitcoin.hashBlock(previousBlockHash, currentBlockData, nonce);

    const newBlock = bitcoin.createNewBlock(nonce, previousBlockHash, blockHash);

    const requestPromises = [];
    bitcoin.networkNodes.forEach(networkNodeUrl => {
        const requestOptions = {
            uri: networkNodeUrl + '/receive-new-block',
            method: 'POST',
            body: { newBlock: newBlock },
            json: true
        };

        requestPromises.push(rp(requestOptions));
    });

    Promise.all(requestPromises)
        .then(data => {
            const requestOptions = {
                uri: bitcoin.currentNodeUrl + '/transaction/broadcast',
                method: 'POST',
                body: {
                    amount: 20.5, //changing mining reward to 20.5
                    sender: "00",
                    recipient: nodeAddress
                },
                json: true
            };

            return rp(requestOptions);
        })
        .then(data => {
            res.json({
                note: 'New block mined successfully',
                block: newBlock
            });
        });
});


app.post('/receive-new-block', function (req, res) {
    const newBlock = req.body.newBlock;
    //validating the received block
    const lastBlock = bitcoin.getLastBlock();
    const correctHash = lastBlock.hash === newBlock.previousBlockHash;
    const correctIndex = lastBlock['index'] + 1 === newBlock['index'];

    if (correctHash && correctIndex) {
        bitcoin.chain.push(newBlock);
        bitcoin.pendingTransactions = [];
        res.json({
            note: 'New block received and accepted. ',
            newBlock: newBlock
        });
    } else {
        res.json({
            note: 'New block rejected',
            newBlock: newBlock
        });
    }
});

app.post('/register-and-broadcast-node', function (req, res) {
    const newNodeUrl = req.body.newNodeUrl;
    if (bitcoin.networkNodes.indexOf(newNodeUrl) == -1) bitcoin.networkNodes.push(newNodeUrl);

    const regNodesPromises = [];
    bitcoin.networkNodes.forEach(networkNodeUrl => {
        const requestOptions = {
            uri: networkNodeUrl + '/register-node',
            method: 'POST',
            body: { newNodeUrl: newNodeUrl },
            json: true
        };

        regNodesPromises.push(rp(requestOptions));
    });

    Promise.all(regNodesPromises)
        .then(data => {
            const bulkRegisterOptions = {
                uri: newNodeUrl + '/register-nodes-bulk',
                method: 'POST',
                body: { allNetworkNodes: [...bitcoin.networkNodes, bitcoin.currentNodeUrl] },
                json: true
            };

            return rp(bulkRegisterOptions);
        })
        .then(data => {
            res.json({ note: 'New node registered with network successfully.' });
        });
});

app.post('/register-node', function (req, res) {
    const newNodeUrl = req.body.newNodeUrl;
    const nodeNotAlreadyPresent = bitcoin.networkNodes.indexOf(newNodeUrl) == -1;
    const notCurrentNode = bitcoin.currentNodeUrl !== newNodeUrl;
    if (nodeNotAlreadyPresent && notCurrentNode) bitcoin.networkNodes.push(newNodeUrl);
    res.json({ note: 'New node registered successfully with node.' });

})

app.post('/register-nodes-bulk', function (req, res) {
    const allNetworkNodes = req.body.allNetworkNodes;
    allNetworkNodes.forEach(networkNodeUrl => {
        const nodeNotAlreadyPresent = bitcoin.networkNodes.indexOf(networkNodeUrl) == -1;
        const notCurrentNode = bitcoin.currentNodeUrl !== networkNodeUrl;
        if (nodeNotAlreadyPresent && notCurrentNode) bitcoin.networkNodes.push(networkNodeUrl);
    });

    res.json({ note: 'Bulk registeration successful.' })
})

app.get('/consensus', function (req, res) {
    const requestPromises = [];
    bitcoin.networkNodes.forEach(networkNodeUrl => {
        const requestOptions = {
            uri: networkNodeUrl + '/blockchain',
            method: 'GET',
            json: true
        };

        requestPromises.push(rp(requestOptions));
    })

    Promise.all(requestPromises)
        .then(blockchains => {
            const currentChainLength = bitcoin.chain.length;
            let maxChainLength = currentChainLength;
            let newLongestChain = null;
            let newPendingTransactions = null;

            blockchains.forEach(blockchain => {
                if (blockchain.chain.length > maxChainLength) {
                    maxChainLength = blockchain.chain.length;
                    newLongestChain = blockchain.chain;
                    newPendingTransactions = blockchain.pendingTransactions;
                }
            })

            if (!newLongestChain || (newLongestChain && !bitcoin.chainIsValid(newLongestChain))) {
                res.json({
                    note: 'Current chain has not been replaced.',
                    chain: bitcoin.chain
                })
            }

            else if (newLongestChain && bitcoin.chainIsValid(newLongestChain)) {
                bitcoin.chain = newLongestChain;
                bitcoin.pendingTransactions = newPendingTransactions;
                res.json({
                    note: 'This chain has been replaced.',
                    chain: bitcoin.chain
                })
            }

        })
})

app.get('/block/:blockHash', function (req, res) {
    const blockHash = req.params.blockHash;
    const correctBlock = bitcoin.getBlock(blockHash);
    res.json({ block: correctBlock });
})

app.get('/transaction/:transactionId', function (req, res) {
    const transactionId = req.params.transactionId;
    const transactionData = bitcoin.getTransaction(transactionId);
    res.json({
        transaction: transactionData.transaction,
        block: transactionData.block
    });
})

app.get('/address/:address', function (req, res) {
    const address = req.params.address;
    const addressData = bitcoin.getAddressData(address);
    res.json({
        addressData: addressData
    })
})

app.get('/block-explorer', function (req, res) {
    res.sendFile('./block-explorer/index.html', { root: __dirname });
})


app.listen(port, function () {
    console.log(`Listening on port ${port}`);
})