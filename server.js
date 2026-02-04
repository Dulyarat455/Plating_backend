const express = require("express");
const app = express();


const bodyParser = require('body-parser');
const cors = require("cors");
const dotenv  = require("dotenv");



dotenv.config();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


const sectionController = require('./controllers/SectionController');
const groupController = require("./controllers/GroupController");
const userController = require("./controllers/UserController");
const partMasterController = require("./controllers/PartMasterController");
const controlLotController = require("./controllers/ControlLotController");
const vendorController = require("./controllers/VendorController");
const issueController = require("./controllers/IssueController");


//user
app.post('/api/user/create',(req, res)=> userController.create(req,res));
app.post('/api/user/signIn',(req, res)=> userController.signin(req,res));
app.post('/api/user/update',(req,res)=> userController.upadate(req,res));


//section
app.post('/api/section/create',(req, res)=> sectionController.add(req,res));


//group
app.post('/api/group/create',(req, res)=> groupController.add(req,res));


//part master
app.post('/api/partMaster/create',(req, res)=> partMasterController.add(req,res));
app.post('/api/partMaster/update',(req, res)=> partMasterController.edit(req,res));
app.post('/api/partMaster/importExcel',(req, res)=> partMasterController.imporExcel(req,res));
app.post('/api/partMaster/filterByGroup',(req, res)=> partMasterController.filterByGroup(req,res));


//controlLot 
app.post('/api/controlLot/create',(req, res)=> controlLotController.add(req,res));
app.get('/api/controlLot/list',(req, res)=> controlLotController.list(req,res));

//vendor
app.post('/api/vendor/create',(req, res)=> vendorController.add(req,res));
app.get('/api/vendor/list', (req, res)=> vendorController.list(req,res));

//issue 
app.post('/api/issue/createHeaderTemp',(req, res)=> issueController.createHeaderTemp(req,res));
app.post('/api/issue/fetchHeaderTempByUser',(req, res)=> issueController.fetchHeaderTemp(req,res));



app.listen(3001,()=>{
    console.log("api strat server running...");
})