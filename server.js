var express = require('express');
var cors = require('cors');
var axios = require('axios');
var WebSocket = require('ws');
const { response } = require('express');
var port = process.env.PORT || 8080;

const server = express().listen(port, () => console.log(`Listen on ${port}`));

const wss = new WebSocket.Server({ server });

let currentData = null;
let miniTickerData = null;

const sendRestAPIReq = setInterval(() => {
  axios.get('https://www.binance.com/exchange-api/v1/public/asset-service/product/get-products')
    .then(response => {
      //console.log(response);
      const responseData = response.data.data;
      currentData = Object.keys(responseData).map(dataKey => {
        return responseData[dataKey];
      }).map(data => {
        return { 'b': data.b, 'q': data.q, 'pm': data.pm, 'symbol':data.b+data.q, 'price': data.c, 'v': data.v }
      });
    })
    .catch(err => {
      console.log(err);
    });
}, 1000);

let timeout = 250;
let wsBinance = null;
wsBinanceConnect = () => {
  wsBinance = new WebSocket('wss://stream.binance.com/stream?streams=!miniTicker@arr');
  let connectInterval;

  wsBinance.on('open', () => {
    console.log('Binance connected!');

    this.timeout = 250;
    clearTimeout(connectInterval);
  });
  
  wsBinance.on('message', event => {
    const responseData = JSON.parse(event).data;
    miniTickerData = Object.keys(responseData).map(dataKey => {
      return { 'symbol': responseData[dataKey].s, 'price': responseData[dataKey].c };
    })
  });
  
  wsBinance.on('close', event =>{
    console.log(`WebSocket is closed. Reconnect will be attempted in ${Math.min(
      10000 / 1000,
      (timeout + timeout) / 1000
    )} second.`,
      event.reason);
      timeout = timeout + timeout;
      connectInterval = setTimeout(checkConnection, Math.min(10000, timeout));
  })



  wsBinance.on('error', error => {
    console.error(
      'WebSocket encountered error: ',
      error.message,
      'Closing WebSocket'
    );
    wsBinance.close();
  });
}

checkConnection = () => {
  console.log('Check connection called');
  if(!wsBinance || wsBinance.readyState === WebSocket.CLOSED){
    wsBinanceConnect();
  }
}

wsBinanceConnect();





let wsInterval = null;
wss.on('connection', ws => {

  //連結時執行此 console 提示
  console.log('Client connected');

  let fullData = null;
  let copyFullData = null;
  wsInterval = setInterval(() => {
    if(currentData && miniTickerData){
      fullData = currentData.map((curData, index) => {
        const match = miniTickerData.find(miniData => {
          return miniData.symbol === curData.symbol;
        });
        if (match) {
          curData.change = (curData.price - match.price) / match.price * 100;
        }
        else {
          if (copyFullData) {
              curData.change = copyFullData[index].change;
          }
          else {
            curData.change = 0;
          }
        }
        return curData;
      });
  
      copyFullData = [...fullData];
      ws.send(JSON.stringify(fullData));
    }
  }, 1000);

  ws.on('message', data => {
    console.log('Forced close Binance WebSocket!');
    if(data === 'close'){
      wsBinance.close();
    }
  })

  //當 WebSocket 的連線關閉時執行
  ws.on('close', () => {
    clearInterval(sendRestAPIReq);
    clearInterval(wsInterval);
    console.log('Close connected')
  })
})
