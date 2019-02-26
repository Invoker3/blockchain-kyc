const express = require('express');
const bodyParser = require('body-parser');
const app = express();
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
const nodemailer = require("nodemailer");
const dotenv = require('dotenv').config();
const request = require('request');

const nodeAddress = uuid().split('-').join('');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const bitcoin = new Blockchain();

var gov = {
    public_key: fs.readFileSync('gov/pubkey.pem'),
    private_key: fs.readFileSync('gov/privkey.pem')
}

var service = {
    public_key: fs.readFileSync('service/pubkey.pem'),
    private_key: fs.readFileSync('service/privkey.pem')
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
    const keyType = req.body.keyType;
    function keypair(pathname) {
        var key = ursa.generatePrivateKey(1024, 65537);
        var privpem = key.toPrivatePem();
        var pubpem = key.toPublicPem();
        var privkey = path.join('keys/' + keyType, pathname, pathname + '.privkey.pem');
        var pubkey = path.join('keys/' + keyType, pathname, pathname + '.pubkey.pem');

        return mkdirpAsync('keys/' + keyType + '/' + pathname).then(function () {
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
        res.json({ note: 'Public/Private keypair generated for ' + keyName });
    });
})

app.post('/input-and-encrypt', function (req, res) {
    // console.log(req.body);
    const name = req.body.name;
    const age = req.body.age;
    const gender = req.body.gender;
    const license = req.body.license;
    const keyName = req.body.keyName;

    const userKeys = {
        public_key: fs.readFileSync('keys/users/' + keyName + '/' + keyName + '.pubkey.pem'),
        //private_key: fs.readFileSync('keys/' + keyName + '/' + keyName + '.privkey.pem')
    }
    console.log(req.body);
    var first_result = crypto.privateEncrypt({
        key: gov.private_key
    }, new Buffer(JSON.stringify(req.body)));
    //console.log(Buffer)
    var second_result = crypto.publicEncrypt({
        key: userKeys.public_key,
        padding: crypto.constants.RSA_NO_PADDING
    }, first_result);

    var encryptedData = second_result.toString('hex');
    const requestOptions = {
        uri: bitcoin.currentNodeUrl + '/transaction/broadcast',
        method: 'POST',
        body: { encryptedData: encryptedData, keyName: keyName },
        json: true
    };
    rp(requestOptions)
        .then(data => {
            res.json({ encryptedData: encryptedData })
        })
})

app.post('/send-email', function (req, res) {
    const keyName = req.body.keyName;
    const keyType = req.body.keyType;
    const recipient = req.body.recipient;
    var smtpTransport = nodemailer.createTransport({
        service: "gmail",
        host: "smtp.gmail.com",
        auth: {
            user: process.env.EMAIL,
            pass: process.env.PASS
        }
    })
    var mailOptions = {
        to: recipient,
        subject: 'Public/Private keys',
        text: 'These are the keys generated. \nDO NOT SHARE YOUR PRIVATE KEY WITH ANYONE ',
        attachments: [{
            path: './keys/' + keyType + '/' + keyName + '/' + keyName + '.pubkey.pem'
        },
        {
            path: './keys/' + keyType + '/' + keyName + '/' + keyName + '.privkey.pem'
        }]
    }
    console.log(mailOptions);
    smtpTransport.sendMail(mailOptions, function (error, response) {
        if (error) {
            console.log(error);
            res.json({ note: 'Operation failed' });
        } else {

            //console.log("Message sent: " + response.message);
            //res.end("sent");
            fs.unlinkSync('./keys/' + keyType + '/' + keyName + '/' + keyName + '.privkey.pem');
        }
        res.json({ note: 'Email sent successfully' });
    });
})

app.get('/fetch-service-providers', function (req, res) {
    var services = []; //this is going to contain paths

    fs.readdir('./keys/services/', function (err, filesPath) {
        if (err) throw err;
        services = filesPath.map(function (filePath) {
            return filePath;
        });
        //console.log(services);
        var keyList = [];
        services.forEach(service => {
            fs.readFile('./keys/services/' + service + '/' + service + '.pubkey.pem', 'utf8', function (err, data) {
                if (err) throw err;
                keyList.push({ name: service, pubkey: data });
                if (service == services[services.length - 1])
                    res.json({ keyList: keyList });
            });
        })
    });
})

app.get('/fetch-pending-requests', function (req, res) {
    request(bitcoin.currentNodeUrl + '/blockchain', { json: true }, (err, blockRes, body) => {
        if (err) { return console.log(err); }
        //console.log(res.body);
        var pendingRequestsList = new Object();
        blockRes.body.pendingRequests.forEach(singleRequest => {
            if(!pendingRequestsList[singleRequest.serviceName])
                pendingRequestsList[singleRequest.serviceName] = [];
            pendingRequestsList[singleRequest.serviceName].push({ encryptedData: singleRequest.encryptedData, transactionId: singleRequest.transactionId, timestamp: singleRequest.timestamp});
        })
        res.json({pendingRequestsList: pendingRequestsList});
    });

})

app.post('/fetch-transactionId', function (req, res) {
    const inputEncryptedData = req.body.inputEncryptedData;
    request(bitcoin.currentNodeUrl + '/blockchain', { json: true }, (err, blockRes, body) => {
        if (err) { return console.log(err); }
        blockRes.body.chain.forEach(block => {
            block.transactions.forEach(transaction=> {
                if(inputEncryptedData == transaction.encryptedData)
                    res.json({transactionId: transaction.transactionId, timestamp: transaction.timestamp})
            })
        })
        //res.json({transactionId: 0});
    });

})
app.post('/encrypt-and-share', function (req, res) {
    //console.log(req.body)
    //const keyName = req.body.keyName;
    const serviceName = req.body.serviceName;
    const userPrivKey = req.body.userPrivKey;
    const servicePubKey = req.body.servicePubKey;
    const inputEncryptedData = req.body.inputEncryptedData;
    const transactionId = req.body.transactionId;
    const timestamp = req.body.timestamp;
    // const userKeys = {
    //     public_key: fs.readFileSync('keys/users/' + keyName + '/' + keyName + '.pubkey.pem'),
    //     private_key: fs.readFileSync('keys/users/' + keyName + '/' + keyName + '.privkey.pem')
    // }
    var new_second_result = new Buffer(inputEncryptedData, "hex");

    var second_plaintext = crypto.privateDecrypt({
        key: userPrivKey,
        padding: crypto.constants.RSA_NO_PADDING
    }, new_second_result);

    var second_result = crypto.publicEncrypt({
        key: servicePubKey,
        padding: crypto.constants.RSA_NO_PADDING
    }, second_plaintext);

    var encryptedData = second_result.toString('hex');
    //console.log(encryptedData);
    const newRequest = {
        serviceName: serviceName,
        encryptedData: encryptedData,
        transactionId: transactionId,
        timestamp: timestamp
    };
    const blockIndex = bitcoin.addTransactionToPendingRequests(newRequest);
    res.json({ encryptedData: encryptedData });

})

app.post('/decrypt-and-output', function (req, res) {
    var second_result = new Buffer(req.body.encryptedData, "hex");

    var second_plaintext = crypto.privateDecrypt({
        key: service.private_key,
        padding: crypto.constants.RSA_NO_PADDING
    }, second_result);
    // console.log(second_plaintext.toString("hex"));

    var first_plaintext = crypto.publicDecrypt({
        key: gov.public_key
    }, second_plaintext);

    var decryptedData = JSON.parse(first_plaintext.toString('utf8'));
    res.json({ decryptedData: decryptedData });


})


app.post('/transaction/broadcast', function (req, res) {
    const newTransaction = bitcoin.createNewTransaction(req.body.encryptedData, req.body.keyName);
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
            request(bitcoin.currentNodeUrl + '/mine');
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
        /*.then(data => {
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
        })*/
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

app.get('/', function (req, res) {
    //res.sendFile('../client/block-explorer/index.html', { root: __dirname });
    res.sendFile(path.resolve('dev/client/index.html'));
})


app.listen(port, function () {
    console.log(`Listening on port ${port}`);
})