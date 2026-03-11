const express = require("express");
const app = express();


const bodyParser = require('body-parser');
const cors = require("cors");
const dotenv  = require("dotenv");

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });


dotenv.config();


const allowedOrigins = [
     // 'http://localhost:4200',
    // 'http://10.121.49.221:4200', // 👈 ใส่ IP เครื่อง Server notebook
    'http://10.121.1.85'// เครื่อง server จริง
  
  ];



app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


//add new for socket
const http = require('http');
const server = http.createServer(app);

const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});




// เก็บ io ไว้ใน global ให้ controller เรียกใช้ได้
global.io = io;

// ลอง log ดู
io.on('connection', (socket) => {
    console.log('client connected:', socket.id);
  
    socket.on('disconnect', () => {
      console.log('client disconnected:', socket.id);
    });
});
// ==== จบส่วน socket.io ====







const sectionController = require('./controllers/SectionController');
const groupController = require("./controllers/GroupController");
const userController = require("./controllers/UserController");
const partMasterController = require("./controllers/PartMasterController");
const controlLotController = require("./controllers/ControlLotController");
const vendorController = require("./controllers/VendorController");
const issueController = require("./controllers/IssueController");
const receiveController = require("./controllers/ReceiveController");
const reportController = require('./controllers/ReportController');




//user
app.post('/api/user/create',(req, res)=> userController.create(req,res));
app.post('/api/user/signIn',(req, res)=> userController.signin(req,res));
app.post('/api/user/update',(req, res)=> userController.upadate(req,res));
app.get('/api/user/list', (req, res)=> userController.list(req,res));
app.post('/api/user/delete', (req, res)=> userController.delete(req,res));
app.put('/api/user/edit',(req, res)=> userController.edit(req,res));
app.post('/api/user/exportExcel',(req, res)=> userController.exportExcel(req,res));
app.post('/api/user/importExcel',upload.single('file'),(req,res)=> userController.importExcel(req,res));
app.post('/api/user/signInRfId',(req, res)=> userController.signInRfId(req,res));



//section
app.post('/api/section/create',(req, res)=> sectionController.add(req,res));
app.get('/api/section/list',(req,res)=> sectionController.list(req,res));
app.post('/api/section/delete',(req,res)=> sectionController.delete(req,res));
app.put('/api/section/edit',(req,res)=> sectionController.edit(req,res));



//group
app.post('/api/group/create',(req, res)=> groupController.add(req,res));
app.get('/api/group/list',(req,res)=> groupController.list(req,res));


//part master
app.post('/api/partMaster/create',(req, res)=> partMasterController.add(req,res));
app.post('/api/partMaster/update',(req, res)=> partMasterController.edit(req,res));
app.post('/api/partMaster/filterByGroup',(req, res)=> partMasterController.filterByGroup(req,res));
app.get('/api/partMaster/list',(req, res)=> partMasterController.list(req,res));
app.post('/api/partMaster/importExcel',upload.single('file'),(req ,res)=> partMasterController.importExcel(req,res));
app.post('/api/partMaster/exportExcel', (req, res) => partMasterController.exportExcel(req, res));

app.put('/api/partMaster/edit',(req, res)=> partMasterController.edit(req,res));
app.post('/api/partMaster/delete',(req, res)=> partMasterController.delete(req,res));




//controlLot 
app.post('/api/controlLot/create',(req, res)=> controlLotController.add(req,res));
app.get('/api/controlLot/list',(req, res)=> controlLotController.list(req,res));
app.put('/api/controlLot/edit', (req, res)=> controlLotController.edit(req,res));
app.post('/api/controlLot/delete', (req, res)=> controlLotController.delete(req,res));



//vendor
app.post('/api/vendor/create',(req, res)=> vendorController.add(req,res));
app.get('/api/vendor/list', (req, res)=> vendorController.list(req,res));
app.put('/api/vendor/edit', (req, res)=> vendorController.edit(req,res));
app.post('/api/vendor/delete', (req, res)=> vendorController.delete(req,res));




//issue 
app.post('/api/issue/createHeaderTemp',(req, res)=> issueController.createHeaderTemp(req,res));
app.post('/api/issue/fetchHeaderTempByUser',(req, res)=> issueController.fetchHeaderTemp(req,res));
app.post('/api/issue/updateHeaderTemp',(req, res)=> issueController.editHeaderTemp(req,res));
app.post('/api/issue/createBoxTemp',(req, res)=> issueController.createBoxTemp(req,res));
app.post('/api/issue/fetchBoxTempByHeadId',(req, res)=> issueController.fetchBoxTempByHeadId(req,res));
app.post('/api/issue/deleteBoxTemp',(req, res)=> issueController.deleteBoxTemp(req,res));
app.put('/api/issue/updateBoxTemp',(req, res)=> issueController.editBoxTemp(req,res));
app.post('/api/issue/deleteBoxTempAll',(req, res)=> issueController.deleteBoxTempAll(req, res));
app.post('/api/issue/deleteHeaderBoxTemp',(req,res)=> issueController.deleteHeaderBoxTemp(req, res));

app.post('/api/issue/createHeaderBox',(req, res)=> issueController.createHeaderBox(req,res));
app.get('/api/issue/list',(req, res)=> issueController.list(req,res));



//Receive
app.post('/api/receive/createHeaderTemp',(req, res) => receiveController.createHeaderTemp(req,res));
app.post('/api/receive/fetchHeaderTempByUser',(req, res)=> receiveController.fetchHeaderTemp(req,res));
app.post('/api/receive/updateHeaderTemp',(req, res)=> receiveController.editHeaderTemp(req,res));
app.post('/api/receive/createBoxTemp',(req, res)=> receiveController.createBoxTemp(req,res));
app.post('/api/receive/fetchBoxTempByHeadId',(req, res)=> receiveController.fetchBoxTempByHeadId(req,res));
app.post('/api/receive/deleteBoxTemp',(req, res)=> receiveController.deleteBoxTemp(req,res));
app.put('/api/receive/updateBoxTemp',(req,res)=> receiveController.editBoxTemp(req,res));
app.post('/api/receive/deleteBoxTempAll',(req,res)=> receiveController.deleteBoxTempAll(req,res));
app.post('/api/receive/deleteHeaderBoxTemp',(req, res)=> receiveController.deleteHeaderBoxTemp(req,res));

app.post('/api/receive/createHeaderBox',(req,res)=> receiveController.createHeaderBox(req,res));
app.get('/api/receive/list',(req, res)=> receiveController.list(req,res));




//Report
app.get('/api/report/list',(req, res)=> reportController.list(req,res));
app.post('/api/report/exportExcel',(req,res)=> reportController.exportExcel(req,res));





// เครื่อง server จริง
server.listen(3005,() => {
  console.log('API + WebSocket listening on port 3004');
});




// app.listen(3001);
// server.listen(3001,'0.0.0.0', () => {
//     console.log('API + WebSocket listening on port 3001');
// });
