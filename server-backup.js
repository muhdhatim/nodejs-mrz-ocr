var express = require('express');
var app = express();

var fs = require('fs');
const multer = require('multer');
const { path, join, resolve, extname, parse: parsePath } = require('path');
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
            let img = req.files.image;
            let form_id = req.body.form_id;
            // console.log(img);
            // console.log(form_id);
            //Use the mv() method to place the file in upload directory (i.e. "uploads")

            // let ts = Math.floor(Date.now() / 1000);

            img.mv(`${upload_path}/${form_id}/full_${img.name}`, err => {
              if (err) {
                return res.status(500).send(err);
              }
              //return response in json
              // res.json({ file: `uploads/${img.name}` });
              // console.log(res.json);

              // send response
              // res.send({
              //     status: true,
              //     message: 'File is uploaded',
              //     data: {
              //         name: img.name,
              //         mimetype: img.mimetype,
              //         size: img.size
              //     }
              // });
              let img_path = `${upload_path}/${form_id}/full_${img.name}`;

              (async() => {

                let mrz_image = await getMrzImage(img_path).then(function(data){
                  // console.log(data['images']['crop']);
                  let new_image = data['images']['crop'];
                  // let new_image = data;
                  return new_image;                  
                });
                // console.log(mrz_image);

                let new_image_64 = mrz_image.toBase64('image/png');

                // console.log(new_image_64);

                let temp_name = img.name;
                temp_name = temp_name.split('.');
                temp_name = temp_name[0];
                
                var buf = Buffer.from(new_image_64, 'base64');
                fs.writeFile(`${upload_path}/${form_id}/crop_${temp_name}.png`, buf, function(err){
                    if (err) throw err;
                    console.log('File saved.')
                })

                let crop_img_path = `${upload_path}/${form_id}/crop_${temp_name}.png`;

                let result = await processFile(crop_img_path).then(function(data){
                  // res.json(data['mrz']);
                  // return data;
                  return data['mrz'];
                });

                // console.log(result);

                const parsed_mrz = parse(result);

                // send response
                // res.send({
                //     status: true,
                //     message: 'MRZ',
                //     data: {
                //       result: parsed_mrz
                //     }
                // });
                res.json({ result: parsed_mrz });
                
              })();
              // console.log(result);
              // res.json({ data: result });

           });
        }
    } catch (err) {
        res.status(500).send(err);
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
      const parsedPath = parsePath(imagePath);
      const result = await readMrz(await IJS.load(imagePath), {
        debug: true,
        saveName: join(parsedPath.dir, '../multiMask/', parsedPath.base)
      });
      // console.log(result);
      // const parsed = parse(result);
      return result;
      
    } catch (e) {
      console.log('read error', e.message, e.stack);
    }
}

async function getMrzImage(imagePath){
  const result = {};
  try {
    return await getMrz(await IJS.load(imagePath), {
      debug: true,
      out: result
    });

  } catch (e) {
    console.error(e);
  }
}