var express = require('express');
var app = express();

var fs = require('fs');
const bodyParser = require("body-parser");
const fileupload = require("express-fileupload");
const jwt = require('jsonwebtoken');

//require MRZ
const IJS = require('image-js').Image;
const { parse } = require('mrz');
const getMrz = require('./src/getMrz');
const readMrz = require('./src/readMrz');
const { off } = require('process');

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

app.get('/api/testlogin', function (req, res) {
  console.log(req.body);
  console.log(req.headers);
  res.json({
    first_name  : 'muhd',
    last_name   : 'hatim',
  });
})

//login api
app.post('/api/login', (req, res) => {
    //dummy
    // const user = {
    //   id: 1,
    //   username: 'itools',
    //   email: 'itools-info@itools.com'
    // }
    const auth_username = "itools@2021";
    const auth_password = "iT0ol5";

    const user = {
      username: req.body.username,
      password: req.body.password,
    }
    // console.log(user);

    if(user.username === auth_username && user.password === auth_password){
        jwt.sign({user: user}, 'secretkey/iT0ol52021', { expiresIn: '1h'}, (err, token) => {
            res.json({
              status: 'true',
              token: token
            });
        });
    }else{
      res.json({
        status: 'false',
        message: 'Invalid Username and Password',
        data: user,
      });
    }

});

app.post('/api/verify_token', function (req, res) {
  // res.send('Hello World');
  jwt.verify(req.token, 'secretkey/iT0ol52021', (err, authData) => {
      if(err){
          // res.sendStatus(403);
          // res.status(403).json('Invalid token, please request new token');
          res.json({
              status: false,
              message: 'Invalid token, please request new token'
          });
      }else{
          //if token is valid, continue
          res.json({
              status: true,
              message: 'Valid token'
          });
      }
  });
})

//passport mrz
app.post('/api/upload', verifyToken, function (req, res) {

  jwt.verify(req.token, 'secretkey/iT0ol52021', (err, authData) => {
      if(err){
        // res.sendStatus(403);
        res.status(403).json('Invalid token, please request new token');
      }else{
          //if token is valid, continue
          try {
              if(!req.files) {
                  res.json({
                      status: false,
                      message: 'No file uploaded'
                  });
              } else {
                  //Use the name of the input field (i.e. "image") to retrieve the uploaded file

                  if((req.files.passport instanceof Array)){//if array/multiple files, please use multiple upload mrz api
                      res.json({
                          status: false,
                          message: 'Select at least one file',
                      });
                      return;
                  }

                  let img = req.files.passport;
                  let form_id = req.body.form_id;
                  // console.log(img);
                  // console.log(form_id);

                  // let passport_img = img.data;//get image buffer

                  (async() => {
                      
                      try {
                        let passport_img = await IJS.load(img.data);//load img from buffer
                        // let crop_passport_img = await getMrzImage(passport_img).then(function(data){
                        let crop_passport_img = await getMrzImage(passport_img.toDataURL()).then(function(data){
                          let new_image = data['images']['crop'];
                          // let new_image = data;
                          return new_image;//return new roi crop image which is mrz region
                        });
                        // console.log(crop_passport_img);
        
                        let result = await readMrzImage(crop_passport_img.toDataURL()).then(function(data){
                          // res.json(data['mrz']);
                          // return data;
                          return data['mrz'];//return mrz code
                        });

                        //replace first line mrz from 0 to O
                        result[0] = result[0].replace(/0/g, "O");
        
                        const parsed_mrz = parse(result);//parse mrz code to personel details
                        // console.log(parsed_mrz);
                        // send response
                        if(parsed_mrz['valid']){
                          res.json({
                              status: true,
                              message: 'Valid MRZ',
                              filename: img.name,
                              data: parsed_mrz,
                              mrz: result
                          });
                        }else{
                          res.json({
                              status: false,
                              message: 'Invalid MRZ',
                              filename: img.name,
                              data: parsed_mrz,
                              mrz: result
                          });
                        }

                        // res.json({ result: parsed_mrz });
                        
                      } catch (error) {
                        console.log(error);
                          res.json({
                              status: false,
                              message: error.message,
                              // data: error.message
                          });
                      }

                  })();

              
              }
          } catch (err) {
            return  res.status(500).send(err);
          }
        
      }
  });

 });

 //Multiple passport mrz
app.post('/api/uploads', verifyToken, function (req, res) {

  jwt.verify(req.token, 'secretkey/iT0ol52021', (err, authData) => {
      if(err){
        // res.sendStatus(403);
        res.status(403).json('Invalid token, please request new token');
      }else{
          //if token is valid, continue
          try {
              if(!req.files) {
                  res.json({
                      status: false,
                      message: 'No file uploaded'
                  });
              } else {
                  const result_data = [];                

                  const file = req.files.passport;
                  // console.log(file instanceof Array);return;

                  if(!(file instanceof Array)){//if not array/multiple files, please use single upload mrz api
                      res.json({
                          status: false,
                          message: 'Select at least more than one file',
                      });
                      return;
                  }
                  
                  for(let i = 0 ; i < file.length; i++){//iterate multiple files

                    // console.log(file[i]);return;

                      //Use the name of the input field (i.e. "image") to retrieve the uploaded file
                      // let img = req.files.passport;
                      // let form_id = req.body.form_id;
                      let img = file[i];
                      // console.log(img);
                      // console.log(form_id);

                      // let passport_img = img.data;//get image buffer

                      (async() => {
                          
                          try {
                            let passport_img = await IJS.load(img.data);//load img from buffer
                            // let crop_passport_img = await getMrzImage(passport_img).then(function(data){
                            let crop_passport_img = await getMrzImage(passport_img.toDataURL()).then(function(data){
                              let new_image = data['images']['crop'];
                              // let new_image = data;
                              return new_image;//return new roi crop image which is mrz region
                            });
                            // console.log(crop_passport_img);
            
                            let result = await readMrzImage(crop_passport_img.toDataURL()).then(function(data){
                              // res.json(data['mrz']);
                              // return data;
                              return data['mrz'];//return mrz code
                            });
            
                            const parsed_mrz = parse(result);//parse mrz code to personel details
            
                            let status;
                            let msg;
                            // send response
                            if(parsed_mrz['valid']){
                              // res.json({
                              //     status: true,
                              //     message: 'Valid MRZ',
                              //     data: parsed_mrz,
                              //     mrz: result
                              // });
                              status = true;
                              msg = "Valid MRZ";

                            }else{
                              // res.json({
                              //     status: false,
                              //     message: 'Invalid MRZ',
                              //     data: parsed_mrz,
                              //     mrz: result
                              // });
                              status = false;
                              msg = "Invalid MRZ";

                            }

                            let result_obj = {
                                status: status,
                                message: msg,
                                filename: img.name,
                                data: parsed_mrz,
                                mrz: result
                            };

                            //push into array
                            result_data.push(result_obj);

                            // res.json({ result: parsed_mrz });

                            // console.log(Object.keys(result_data).length);
                            // console.log(file.length);
                            if (Object.keys(result_data).length === file.length) res.json(result_data);//return json final result
                            
                          } catch (error) {
                            console.log(error);
                              res.json({
                                  status: false,
                                  message: error.message,
                                  // data: error
                              });
                          }

                      })();

                  }
              
              }
          } catch (err) {
            return  res.status(500).send(err);
          }
        
      }
  });

 });


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

//Format of TOKEN
// Authorization: Bearer <access_token>

//function verifyToken
function verifyToken(req, res, next){
    //Get auth header value
    const bearerHeader = req.headers['authorization'];
    //check if bearer is undefined
    if(typeof bearerHeader !== 'undefined'){
        // Split at space
        const bearer = bearerHeader.split(' ');
        // Get Token from array
        const bearerToken = bearer[1];
        // Set the TOKEN
        req.token = bearerToken;
        // Next middleware
        next();
    }else{
        //Forbidden
        // res.sendStatus(403);
        res.status(403).json('Invalid token, please request new token');
    }
}

async function readMrzImage(imagePath) {
    try {
      // const parsedPath = parsePath(imagePath);
      return result = await readMrz(await IJS.load(imagePath), {
        debug: true,
        // saveName: join(parsedPath.dir, '../multiMask/', parsedPath.base)
      });
      // return result;
      
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