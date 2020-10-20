const bsv = require('bsv');
const rpc = require('node-bitcoin-rpc');
const fs = require('fs');
const minimumSplitAmount = 0.0001;
let config;
try{
config = JSON.parse(fs.readFileSync('./config.json'));
} catch (e){
  console.log('Unable to read/parse config.json');
  console.log(e);
  process.exit(0);
}

rpc.init(config.host, config.port, config.rpcuser, config.rpcpassword)
rpc.setTimeout(config.rpctimeout);

rpc.call('listunspent',[],(err,res)=>{
  if (err !== null){
    console.log(err);
    console.log('Problem calling list unspent; check config');
    process.exit(0)
  }else{
    //console.log(res);
    //exit();
    go();
  }
});


async function call(method,params = []){
  return new Promise((res,rej)=>{
    rpc.call(method,params,(err,response)=>{
      if (err !== null){
        rej(err);
      }else if (response.error){
        rej(response.error);
      }else{        
        res(response.result);
      }
    });
  })
}

async function go(){
  try{
  let unspent = await call('listunspent');
  let splitUtxo = unspent.find((utxo)=>utxo.amount > minimumSplitAmount);
  if(splitUtxo === undefined){
    console.log(`We could not find a unspent utxo with at least ${minimumSplitAmount}`);
    process.exit(0)
  }
  let privateKey = await call('dumpprivkey',[splitUtxo.address])
  let PrivateKey = new bsv.PrivateKey(privateKey);
  let splitTransaction = new bsv.Transaction().from(splitUtxo);
  let fee = config.utxostogenerate * 0.00000001 * 100000000;
  let amountPerOutput = Math.round((parseFloat(splitUtxo.amount) / config.utxostogenerate) *100000000) - fee;
  console.log(`Each output will get ~ ${amountPerOutput} sats or ${amountPerOutput/100000000} bsv with fee of ${fee}`)
  for ( let i = 0; i < config.utxostogenerate; i++ ){
    splitTransaction.to(config.toaddress, amountPerOutput);
  }
  splitTransaction.sign(PrivateKey);
  console.log("Sending transaction");
  
  let tx = await call('sendrawtransaction',[splitTransaction.serialize()])
  console.log(tx);
  }catch(e){
    console.error(e);
    process.exit(0);
  }

}