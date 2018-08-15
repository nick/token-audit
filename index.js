const fs = require('fs')
const Xray = require('x-ray');
const superagent = require('superagent')
const spawn = require('child_process').spawn

const x = Xray({
  filters: {
    trim: (value) => typeof value === 'string' ? value.trim() : value,
    btc: (value) => {
      if (typeof value === 'string') {
        var btc = value.match(/([0-9\.]+) Btc/)
        return btc ? btc[1] : value
      }
      return value
    },
    eth: (value) => {
      if (typeof value === 'string') {
        var eth = value.match(/([0-9\.]+) Eth/)
        return eth ? eth[1] : value
      }
      return value
    },
    beforeColon: (value) => {
      if (typeof value === 'string') {
        var val = value.match(/([^:]+): /)
        return val ? val[1] : value
      }
      return value
    },
    afterColon: (value) => {
      if (typeof value === 'string') {
        var val = value.match(/[^:]+: (.*)/)
        return val ? val[1] : value
      }
      return value
    },
    split: function (value, id, idx) {
      if (typeof value !== 'string') return value
      return value.split(id)[idx];
    },
  }
});

function getTokens() {
  x('https://etherscan.io/tokens', '#ContentPlaceHolder1_divresult table tbody tr', [{
    title: 'h5 a',
    link: 'h5 a@href',
    description: 'td:nth-child(3) small',
    price: 'td:nth-child(5) span',
    priceBtc: 'td:nth-child(5) font | btc',
    priceEth: 'td:nth-child(5) font | eth',
    volume24h: 'td:nth-child(7) | trim',
    marketCap: 'td:nth-child(8) | trim',
  }])
    .paginate('#ContentPlaceHolder1_divpagingpanel p>span a:nth-child(4)@href')
    .limit(12)
    // .then(function (res) {
    //   console.log(res[0]) // prints first result
    // })
    .write('results.json')
}

async function getContract(addr) {
  return await x(`https://etherscan.io/address/${addr}`, {
    contractCode: '#editor',
    ethBalance: '#ContentPlaceHolder1_divSummary div:nth-child(1) table tr:nth-child(2) td:nth-child(2) | trim',
    ethValue: '#ContentPlaceHolder1_divSummary div:nth-child(1) table tr:nth-child(3) td:nth-child(2) | trim',
    transactions: '#ContentPlaceHolder1_divSummary div:nth-child(1) table tr:nth-child(4) td:nth-child(2) | split:" ",0 | trim',

    creator: '#ContentPlaceHolder1_divSummary div:nth-child(2) table tr:nth-child(3) td:nth-child(2) > a | trim',
    creationTx: '#ContentPlaceHolder1_divSummary div:nth-child(2) table tr:nth-child(3) td:nth-child(2) > span > a | trim',
  })
}

async function getToken(addr) {
  return await x(`https://etherscan.io/token/${addr}`, {
    supply: '#ContentPlaceHolder1_divSummary div:nth-child(1) table tr:nth-child(2) td:nth-child(2) | split:" ",0 | trim',
    priceUsd: '#ContentPlaceHolder1_divSummary div:nth-child(1) table tr:nth-child(3) td:nth-child(2) | split:" ",0 | trim',
    holders: '#ContentPlaceHolder1_divSummary div:nth-child(1) table tr:nth-child(4) td:nth-child(2) | split:" ",0 | trim',
    site: '#ContentPlaceHolder1_divSummary div:nth-child(1) table tr:nth-child(6) td:nth-child(2) a@href',
    reputation: '.repStyle font | trim',

    contract: '#ContentPlaceHolder1_divSummary div:nth-child(2) table tr:nth-child(2) td:nth-child(2) | trim',
    decimals: '#ContentPlaceHolder1_divSummary div:nth-child(2) table tr:nth-child(3) td:nth-child(2) | trim',

    links: x('#ContentPlaceHolder1_divSummary div:nth-child(2) table tr:nth-child(4) td:nth-child(2) li', [{
      value: 'a@data-original-title | afterColon',
      label: 'a@data-original-title | beforeColon'
    }]),

    info: x('#tokenInfo .panel-info tr', [{
      label: 'td:nth-child(1) | trim',
      value: 'td:nth-child(3) | trim'
    }]),
  })
}

function getSymbol(token) {
  return token.title.split(/[()]/)[1]
}

function getInfo(data, label) {
  const row = data.find(i => i.label === label)
  return row ? row.value : ''
}

async function getAllData(tokens) {
  for (const token of tokens) {
    const splitLink = token.link.split('/')
    const addr = splitLink[splitLink.length - 1]
    const symbol = getSymbol(token)

    try {
      const tokenData = await getToken(addr)
      const contract = await getContract(addr)
      const txData = await getTimestamp(contract.creationTx)
      const title = token.title.split(" (")[0]

      const circulatingSupply = getInfo(tokenData.info, 'Circulating supply')
      const icoStartDate = getInfo(tokenData.info, 'ICO Start Date')
      const icoEndDate = getInfo(tokenData.info, 'ICO End Date')
      const icoTotalCap = getInfo(tokenData.info, 'Total Cap')
      const icoTotalRaised = getInfo(tokenData.info, 'Total Raised')
      const country = getInfo(tokenData.info, 'Country')

      const [icoPriceUsd, icoPriceEth, icoPriceBtx] = getInfo(tokenData.info, 'ICO Price').split(' | ')

      const email = getInfo(tokenData.links, 'Email')
      const blog = getInfo(tokenData.links, 'Blog')
      const slack = getInfo(tokenData.links, 'Slack')
      const facebook = getInfo(tokenData.links, 'Facebook')
      const twitter = getInfo(tokenData.links, 'Twitter')
      const github = getInfo(tokenData.links, 'Github')
      const telegram = getInfo(tokenData.links, 'Telegram')
      const whitepaper = getInfo(tokenData.links, 'Whitepaper')
      const coinMarketCap = getInfo(tokenData.links, 'CoinMarketCap')
      const coinGecko = getInfo(tokenData.links, 'CoinGecko')

      const data = { ...token, ...tokenData, ...contract, ...txData, ...{
        icoPriceUsd: icoPriceUsd ? icoPriceUsd.split(' ')[0] : '',
        icoPriceEth: icoPriceEth ? icoPriceEth.split(' ')[0] : '',
        icoPriceBtx: icoPriceBtx ? icoPriceBtx.split(' ')[0] : '',
        title, symbol, circulatingSupply, icoStartDate, icoEndDate,
        icoTotalCap, icoTotalRaised, country,
        email, blog, slack, facebook, twitter, github, telegram,
        whitepaper, coinMarketCap, coinGecko
      } }

      const contractCode = data.contractCode
      delete data.contractCode
      delete data.links
      delete data.info

      const jsonStr = JSON.stringify(data, null, 4)

      fs.writeFileSync(`${__dirname}/contracts/${symbol}.sol`, contractCode)
      fs.writeFileSync(`${__dirname}/data/${symbol}.json`, jsonStr)

      // console.log(jsonStr)

      console.log(`Processed ${symbol}`)
    } catch(e) {
      console.log(`Error processing ${token.title}`, e)
    }
  }
}

async function getTimestamp(tx) {
  const transaction = await superagent
    .post("https://mainnet.infura.io/")
    .send({
      "jsonrpc": "2.0",
      "id": 61,
      "method": "eth_getTransactionByHash",
      "params": [tx]
    })
  const blockNumber = transaction.body.result.blockNumber
  const block = await superagent
    .post("https://mainnet.infura.io/")
    .send({
      "jsonrpc": "2.0",
      "id": 61,
      "method": "eth_getBlockByNumber",
      "params": [blockNumber, false]
    })
  const timestamp = parseInt(block.body.result.timestamp)
  const createTime = new Date(timestamp * 1000).toISOString()

  return {
    timestamp,
    blockNumber: parseInt(blockNumber),
    createDate: createTime.substr(0, 10),
    createTime
  }
}

const Tokens = JSON.parse(fs.readFileSync('results.json'))

const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const csvWriter = createCsvWriter({
    path: 'results.csv',
    header: [
        { id: 'title', title: 'Title' },
        { id: 'symbol', title: 'Symbol' },
        { id: 'createDate', title: 'Deploy Date' },
        { id: 'marketCap', title: 'Market Cap' },
        { id: 'holders', title: 'Holders' },
        { id: 'transactions', title: 'Transactions' },
        { id: 'volume24h', title: 'Volume 24h' },
        { id: 'supply', title: 'Supply' },
        { id: 'country', title: 'Country' },
        { id: 'reputation', title: 'EtherScan Reputation' },
        { id: 'description', title: 'Description' },
        { id: 'site', title: 'Site' },
        { id: 'icoStartDate', title: 'ICO Start Date' },
        { id: 'icoEndDate', title: 'ICO End Date' },
        { id: 'icoTotalRaised', title: 'ICO Total Raised' },
        { id: 'price', title: 'Price' },
        { id: 'priceBtc', title: 'Price BTC' },
        { id: 'priceEth', title: 'Price ETH' },
        { id: 'contract', title: 'Contract' },
        { id: 'decimals', title: 'Decimals' },
        { id: 'creator', title: 'Creator' },
        { id: 'creationTx', title: 'Creation Tx' },
        { id: 'timestamp', title: 'Timestamp' },
        { id: 'circulatingSupply', title: 'Circulating Supply' },
        { id: 'icoTotalCap', title: 'ICO Total Cap' },
        { id: 'link', title: 'EtherScan' },
        { id: 'email', title: 'Email' },
        { id: 'blog', title: 'Blog' },
        { id: 'slack', title: 'Slack' },
        { id: 'facebook', title: 'Facebook' },
        { id: 'twitter', title: 'Twitter' },
        { id: 'github', title: 'GitHub' },
        { id: 'telegram', title: 'Telegram' },
        { id: 'whitepaper', title: 'Whitepaper' },
        { id: 'coinMarketCap', title: 'CoinMarketCap' },
        { id: 'coinGecko', title: 'CoinGecko' },
    ]
});

async function writeCsv(tokens) {
  const records = []
  for (const token of tokens) {
    const symbol = getSymbol(token)
    try {
      const data = JSON.parse(fs.readFileSync(`${__dirname}/data/${symbol}.json`))
      records.push(data)
    } catch(e) {
      console.log(`Error with ${token.symbol}`)
    }
  }
  await csvWriter.writeRecords(records)
  console.log("Done")
}

async function writeAbi(tokens) {
  const records = []
  const contractNames = {}
  for (const token of tokens) {
    const symbol = getSymbol(token)
    console.log(`Processing ${symbol}`)
    try {
      var data = await new Promise((resolve, reject) => {
        let data = ''
        const solc = spawn('solc', [
          '--combined-json=abi',
          `contracts/${symbol}.sol`
        ])
        solc.stdout.on('data', (d) => data += d);
        solc.stderr.on('data', (d) => d.toString());
        solc.on('close', () => resolve(data))
      })

      const contracts = JSON.parse(data).contracts
      const output = {}

      for (let contract in contracts) {
        const contractName = contract.split(':')[1]
        contractNames[contractName] = contractNames[contractName] || 0
        contractNames[contractName] += 1
        const abi = JSON.parse(contracts[contract].abi)
        output[contractName] = {
          // abi, // Uncomment to include full ABI in output
          functions: abi.filter(a => a.type === 'function').map(a => a.name),
          events: abi.filter(a => a.type === 'event').map(a => a.name)
        }
      }

      fs.writeFileSync(`${__dirname}/abi/${symbol}.json`, JSON.stringify(output, null, 4))
    } catch(e) {
      console.log(`Error with ${symbol}`)
      // console.log(e)
    }
  }

  let contractNameStats =
    Object.keys(contractNames)
    .map(n => [n, contractNames[n]])
    .filter(n => n[1] > 1)
    .sort((a, b) => {
      if(a[1] > b[1]) return -1
      if(a[1] < b[1]) return 1
      return 0
    })

  // console.log(contractNameStats)

  console.log("Done")
}

// getTokens() // Uncomment this to scrape the list of tokens
// getAllData(Tokens) // Uncomment this to scrape each token
// writeCsv(Tokens) // Uncomment this to generate a CSV of token data
// writeAbi(Tokens) // Uncomment this to generate abi / stats for each contract. Requires solc in path
