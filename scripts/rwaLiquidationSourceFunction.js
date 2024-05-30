const tokenRWASymbol = args[0];
const apiResponse = await Functions.makeHttpRequest({
  url: `https://blockshield-insurance-service-d541038b7771.herokuapp.com/api/v1/assets/${tokenRWASymbol}/settled`
});
if (apiResponse.error) {
  throw Error('Request failed');
}
const { data } = apiResponse;
const settled = data.settled;
const settledUint8 = settled ? 1 : 0;
return Functions.encodeUint256(settledUint8);