var express = require('express');
var app = express();

var fs = require('fs');
const bodyParser = require("body-parser");
const fileupload = require("express-fileupload");

//require MRZ
const IJS = require('image-js').Image;
const { parse } = require('mrz');
const getMrz = require('./src/getMrz');
const readMrz = require('./src/readMrz');

let today = dmy();
const upload_path = `${__dirname}/uploads/${today}`;

//use filesystem
// app.use(fileupload());
app.use(fileupload({
  createParentPath: true
}));

// Configurations for "body-parser"
app.use(
    bodyParser.urlencoded({
      extended: true,
    })
  );

app.get('/', function (req, res) {
   res.send('Hello World');
})

app.post('/upload', function (req, res) {
    // res.send('Hello World');
    // console.log(req.files);
    try {
        if(!req.files) {
            res.send({
                status: false,
                message: 'No file uploaded'
            });
        } else {
            //Use the name of the input field (i.e. "image") to retrieve the uploaded file
            let img = req.files.passport;
            let form_id = req.body.form_id;
            // console.log(img);
            // console.log(form_id);

            let passport_img = img.data;//get image buffer

            (async() => {
                
                try {

                  let crop_passport_img = await getMrzImage(passport_img).then(function(data){
                    let new_image = data['images']['crop'];
                    // let new_image = data;
                    return new_image;//return new roi crop image which is mrz region
                  });
                  // console.log(mrz_image);
  
                  let result = await processFile(crop_passport_img.toDataURL()).then(function(data){
                    // res.json(data['mrz']);
                    // return data;
                    return data['mrz'];//return mrz code
                  });
  
                  const parsed_mrz = parse(result);
  
                  // send response
                  if(parsed_mrz['valid']){
                    res.send({
                        status: true,
                        message: 'Valid MRZ',
                        data: parsed_mrz,
                        mrz: result
                    });
                  }else{
                    res.send({
                        status: false,
                        message: 'Invalid MRZ',
                        data: parsed_mrz,
                        mrz: result
                    });
                  }

                  // res.json({ result: parsed_mrz });
                  
                } catch (error) {
                  console.log(error);
                    res.send({
                        status: false,
                        message: 'Invalid MRZ',
                        data: error
                    });
                }

            })();

         
        }
    } catch (err) {
       return  res.status(500).send(err);
    }
 })


var server = app.listen(8081, function () {
   var host = server.address().address
   var port = server.address().port
   
   console.log("Example app listening at http://%s:%s", host, port)
})

function dmy(){
  var today = new Date();
  var dd = String(today.getDate()).padStart(2, '0');
  var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
  var yyyy = today.getFullYear();
  today = yyyy + '-' + mm + '-' + dd;
  return today;
}

async function processFile(imagePath) {
    try {
      // const parsedPath = parsePath(imagePath);
      const result = await readMrz(await IJS.load(imagePath), {
        debug: true,
        // saveName: join(parsedPath.dir, '../multiMask/', parsedPath.base)
      });
      return result;
      
    } catch (e) {
      console.log('read error', e.message, e.stack);
    }
}

async function getMrzImage(image){
  const result = {};
  try {
    return await getMrz(await IJS.load(image), {
      debug: true,
      out: result
    });

  } catch (e) {
    console.error(e);
  }
}