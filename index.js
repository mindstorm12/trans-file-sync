/*This script does the following:
* Updates the database after receiving the file from Arcadium
* Checks if the images listed exist in the database
* If image don't exist in the database, checks if images exist on the Arcadium
* server
* downloads the images
* adds them to the database
* deletes them from temporary location
*/

const csv = require('csv-parser');
const fs = require('fs');
const request = require('request');
const fastcsv = require("fast-csv");
const qs = require("qs");
const cron = require('node-cron');
const express = require('express');
const axios = require('axios');
require('dotenv').config();

const invJSON = [];


app = express();

// Schedule tasks to be run on the server.
cron.schedule('30 19 * * *', function() {
  var currentDateTime = new Date().toJSON();
  console.log('Running file sync at' + currentDateTime);
  readFromFile();
});

app.listen(3000);

// readFromFile();

async function readFromFile(){

  //read from file
fs.createReadStream(process.env.READ_STREAM)
    .pipe(csv())
    .on('data', (row) => {
      invJSON.push(row);
    })
    .on('end', () => {
      console.log('CSV file successfully processed');

      updateDB(invJSON, function(){
            downloadImgFiles(invJSON);
            exportSelecTrucks(invJSON, function(){
              uploadSelecTrucks();
            });
      });
    });
    //end of reading from file
}

function updateDB(invJSON, callback){
  //update Mongodb

  var MongoClient = require('mongodb').MongoClient;
  var url = "mongodb://localhost:27017/";

  MongoClient.connect(url, function(err, db) {
    if (err) throw err;
    var dbo = db.db("hueco_mundo");

      //update many documents based on data values

      invJSON.forEach((item, i) => {
        //get current datetime
        var currentDateTime = new Date().toJSON();

        if (item.Photos && item.xSellingStatus == 'Available'){item.published_at = currentDateTime}

        const query = { StockNo: item.StockNo};
        const update = { $set: item };
        const options = {upsert: true };
        dbo.collection("vehicles_raws").updateOne(query, update, options);
      });

db.close();
console.log('db updated');

});

//endof update
callback();
}

function downloadImgFiles(invJSON){

  const downloadLocation = 'img/';

  invJSON.forEach((item, i) => {

    if(item.Photos){
      var photosString = item.Photos;
      var photosArray = photosString.split(";");

      photosArray.forEach((item2, i) => {

        //get image name
        var slugArray = item2.split("/");
        var imageName = slugArray.slice(-1);
        //end of getting image name

          /*Create an axios request, if the object returns true, don't do anything
          *if it returns false take the following steps:
          * 1. Download the images
          * 2. Upload to Strapi
          * 3. Delete the Image file*/

          //check if image exists in Strapi database
          axios.get(process.env.VUE_APP_API_URL_HOST + '/trucks-images?img.name_contains='+ imageName)

          .then(function (response) {
          // handle success
            // console.log(response.status);
            if (response.data.length > 0){
              console.log('Image download not required');
            }
            else {
              console.log(imageName + " will be downloaded..");

              //check if file exists and then download it
              request(item2, function (error, response, body) {
                if ( response && (response.statusCode != '404')){
                  download(item2, downloadLocation+imageName, function(){
                    updateImageFile(downloadLocation+imageName, item.StockNo, i);
                  });
              }else {
                console.log(item2 + " File does not exist")
              }
              });

            }
          })
          .catch(function (error) {
            // handle error
            console.log('get Error:' + error);
          })
          //end of checking image
      });
    }
  });

  //download function
  var download = function(uri, filename, callback){

    request.head(uri, function(err, res, body){
    // console.log('content-type:', res.headers['content-type']);
    // console.log('content-length:', res.headers['content-length']);

    request(uri).pipe(fs.createWriteStream(filename)).on('close', function(){
      callback();
    });
    });

  };
}//end of function


function updateImageFile(imageFile, stockNo, i){
//update database here
//use axios to get _id using stockNo and then add to Photos Field
var axios = require('axios');
var FormData = require('form-data');
var fs = require('fs');
var formData = new FormData();
var data = {};

      // console.log(JSON.stringify(response.data._id));
      // response.data.GalleryImages[i] = '';

      //get file size
      // var stats = fs.statSync(imageFile)
      // var fileSizeInBytes = stats.size;
      //end of getting file size


        console.log("adding to database: "+imageFile);
        formData.append('files.img', fs.createReadStream(imageFile));
        // formData.append("StockNo", stockNo);
        data['StockNo'] = stockNo;
        formData.append('data', JSON.stringify(data));
        // formData.append("SortOrder", '5');

        var config = {
          method: 'post',
          url: process.env.VUE_APP_API_URL_HOST + '/trucks-images',
          headers: {
            ...formData.getHeaders()
          },
          data : formData
        };

        //after file is added delete the file from temporary location
        axios(config).then(function(response){
          fs.unlink(imageFile, function (err) {
            if (err) throw err;
          });
        })
        .catch(function (error) {
          console.log('post error: ' + error);
        });
        //end of adding images

  }




function exportSelecTrucks(invJSON, callback){
const ws = fs.createWriteStream("data/tstcexport.csv");
      //export many documents based on data values
var exportArray = [];
      invJSON.forEach((item, i) => {
        if (item.Photos && item.categorie == 'TRK' && item.xCondition == 'Used' && item.xType == 'Truck' && item.xSellingStatus == 'Available'){


exportArray.push({
  buffer_id:item.StockNo,
  StockNumber:item.StockNo,
  Year:item.xYear,
  Make: item.xMake,
  Model:item.xModel,
  Type:item.xSleeper,
  VIN:item.xVIN,
  price:'',
  truckcondition:item.xCondition,
  Sleeper:'',
  EngineMake:item.xEngineManufacturer,
  EngineModel:item.xEngineModel,
  HP:item.xEngineHP,
  EngineBrake:item.xEngineBrake,
  Axles:item.xRearAxleRatio,
  Suspension:item.xSuspensionType,
  Transmission:item.xTransmissionModel,
  FCapacity:'',
  RCapacity:'',
  GVWR:item.xGVWR,
  Wheelbase:item.xWheelbase,
  Tires:item.xFrontTires,
  ExtNotes:'',
  RearEndRatio:item.xRearAxleRatio,
  Color:item.xColorExterior,
  Odometer:item.xOdometer,
  Dealership:'Transolutions Truck Centres Ltd.',
  City:'Winnipeg',
  State:'MB',
  LastEditDate:'',
  Photos:item.Photos,
  enabled:''

});
        }
      });

      fastcsv
        .write(exportArray, { headers: true })
        .on("finish", function() {
          console.log("Write to tstcexport.csv successfully!");
          callback();
        })
        .pipe(ws);

}

function uploadSelecTrucks(){
  console.log("Selectrucks is being uploaded");
}
