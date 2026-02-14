const {PrismaClient} = require('../generated/prisma');
const { editBoxTemp, list } = require('./IssueController');
const { edit } = require('./PartMasterController');

const prisma = new PrismaClient();

module.exports = {
           
 //************************** Part Temp ************************* */ 

    createHeaderTemp: async (req,res) =>{ 
        try{
            const{
                userId, groupId, shift, venderId, controlLotId,
                itemNo, itemName, qtyBox, receiveDateByUser     
            } = req.body;

            if (
                userId == null ||
                groupId == null ||
                shift == null || 
                venderId == null ||
                controlLotId == null ||
                itemNo == null ||
                itemName == null ||
                qtyBox == null ||
                receiveDateByUser == null
              ) {
                return res.status(400).send({ message: 'missing_required_fields' });
              }

              const sentDate = new Date(receiveDateByUser);
                if (isNaN(sentDate.getTime())) {
                    return res.status(400).send({ message: 'invalid_sentDateByUser' });
                }

                const headerReceiveTemp = await prisma.headerReceiveTemp.create({
                    data: {
                      userId: parseInt(userId),
                      groupId: parseInt(groupId),
                      venderId: parseInt(venderId),
                      controlLotId: parseInt(controlLotId),
                      receiveDateByUser: sentDate,
                      shift,
                      itemNo,
                      itemName,
                      qtyBox: parseInt(qtyBox),
                    }
                  });
              
                  return res.send({
                    message: 'add_receive_header_temp_success',
                    data: headerReceiveTemp,
                  });


        }catch(e){
            return res.status(500).send({ error: e.message });
        }
    },

    fetchHeaderTemp: async (req,res) =>{ 
        try{
            const { userId } = req.body;

            const headerIssueTemp = await prisma.headerReceiveTemp.findFirst({
                where: {
                    status: 'use',       
                    userId: parseInt(userId)
                },
                orderBy: { id: 'desc' }
              });
            

              return res.send({ results: headerIssueTemp });  

        }catch(e){
            return res.status(500).send({ error: e.message });
        }
    },


    editHeaderTemp: async (req,res) =>{ 
        try{
            const { 
                headTempId,
                    userId, 
                    groupId, 
                    shift,
                    venderId,
                    controlLotId,
                    itemNo,
                    itemName,
                    qtyBox,
                    receiveDateByUser,
            } = req.body;

            if (
                headTempId == null || 
                userId == null ||
                groupId == null ||
                shift == null || 
                venderId == null ||
                controlLotId == null ||
                itemNo == null ||
                itemName == null ||
                qtyBox == null ||
                receiveDateByUser == null
              ) {
                return res.status(400).send({ message: 'missing_required_fields' });
              }

              const sentDate = new Date(receiveDateByUser);
              if (isNaN(sentDate.getTime())) {
                return res.status(400).send({ message: 'invalid_sentDateByUser' });
              }

              // update headTemp issue
              const headerIssueTemp = await prisma.headerReceiveTemp.update({
                  where:{
                      id: parseInt(headTempId)
                  },
                data: {
                  userId: parseInt(userId),
                  groupId: parseInt(groupId),
                  venderId: parseInt(venderId),
                  controlLotId: parseInt(controlLotId),
                  receiveDateByUser: sentDate,
                  shift,
                  itemNo,
                  itemName,
                  qtyBox: parseInt(qtyBox),
                }
              });

              return res.send({
                message: 'edit_Receive_header_temp_success',
                data: headerIssueTemp,
              })

        }catch(e){
            return res.status(500).send({ error: e.message });
        }
    },


    createBoxTemp: async (req,res) =>{
        try{
            const {
                   headTempId,
                   itemNo, 
                   itemName,
                   wosNo,
                   dwg,
                   dieNo,
                   lotNo,
                   qty
                } = req.body ;


                if (
                    headTempId == null ||
                    itemNo == null ||
                    itemName == null ||
                    wosNo == null ||
                    dwg == null ||
                    dieNo == null ||
                    lotNo == null ||
                    qty == null 
                  ) {
                    return res.status(400).send({ message: 'missing_required_fields' });
                  }

                  //check in table box before scan receive temp 
                  const  checkBoxIssue = await prisma.box.findFirst({
                    where: {
                        wosNo: wosNo,
                        BoxState: "wait",
                        status: "use"
                    }
                  }) 
                  if(!checkBoxIssue){
                    return res.status(400).send({ message: 'WOS No นี้ยังไม่ได้ issue ' });
                  }

                  const checkScanRepeat = await prisma.boxReceiveTemp.findFirst({
                    where:{
                      wosNo: wosNo,
                      status: "use"
                    }
                  })
                  if(checkScanRepeat){
                    return res.status(400).send({ message: 'WOS No นี้ถูก Scan ไปแล้ว' });
                  }


                  const boxIssueTemp = await prisma.boxReceiveTemp.create({
                    data: {
                      headerId: parseInt(headTempId) ,
                      itemNo: itemNo,
                      itemName: itemName,
                      wosNo: wosNo,
                      dwg: dwg,
                      dieNo: dieNo,
                      lotNo: lotNo,
                      qty: parseInt(qty)
                    }
                  });

                  return res.send({
                    message: 'add_box_issue_temp_success',
                    data: boxIssueTemp,
                });


        }catch(e){
            return res.status(500).send({ error: e.message });
        }

    },


    fetchBoxTempByHeadId : async (req,res) =>{
        try{
            const {headerId} = req.body;

            const rows = await prisma.boxReceiveTemp.findMany({
              where: {
                  status: 'use',
                  headerId: parseInt(headerId)
              },
              select:{
                id: true,
                headerId: true,
                itemNo: true,
                itemName: true,
                wosNo: true,
                dwg: true,
                dieNo: true,
                lotNo: true,
                qty: true
              }
          })
          return res.send({ results: rows })


        }catch(e){
            return res.status(500).send({ error: e.message });
        }
    },

    deleteBoxTemp : async(req,res) =>{
        try{
          const {boxTempId} = req.body;
      
          if (boxTempId == null) {
            return res.status(400).send({ message: "missing_required_fields" });
          }
      
          const current = await prisma.boxReceiveTemp.findFirst({
            where: { id: parseInt(boxTempId), status: "use" },
            select: { id: true },
          });
      
          if (!current) {
            return res.status(404).send({ message: "boxTemp_not_found" });
          }
      
          // ✅ Soft delete
          const deleted = await prisma.boxReceiveTemp.update({
            where: { id: current.id },
            data: { status: "delete" }, // หรือ "inactive" ตามที่คุณกำหนด
            select: {
              id: true,
              itemNo: true,
              itemName: true,
              wosNo: true,
            },
          });
      
          return res.send({ message: "delete_box_temp_success", data: deleted });
        }catch(e){
          return res.status(500).send({ error: e.message });
        } 
    },


    editBoxTemp : async(req,res) =>{
        try{

          const {
            boxTempId, 
            qty  } = req.body;
  
            const current = await prisma.boxReceiveTemp.findFirst({
              where: { id: parseInt(boxTempId), status: "use" },
              select: { id: true },
            });  
  
            if (!current) {
              return res.status(404).send({ message: "boxTemp_not_found" });
            }
  
            const update = await prisma.boxReceiveTemp.update({
              where: { id: current.id,
                status: "use"
               },
              data: { 
                  qty: parseInt(qty) 
               }, // หรือ "inactive" ตามที่คุณกำหนด
              select: {
                id: true,
                itemNo: true,
                itemName: true,
                wosNo: true,
              },
            });
        
            return res.send({ message: "update_box_temp_success", data: update });
        }catch(e){
          return res.status(500).send({ error: e.message });
        }
    },



    deleteBoxTempAll:  async(req,res)=>{
      try{  
        const {headerTempId} = req.body;

        if(headerTempId ==  null){
          return res.status(400).send({ message: "missing_required_fields" });
        }

       const  deleteBoxTempAll = await prisma.boxReceiveTemp.deleteMany({
        where: { headerId: parseInt(headerTempId)  },
      }); 

      return res.send({ message: "delete_box_temp_all_success", data: deleteBoxTempAll });

      }catch(e){
        return res.status(500).send({ error: e.message });
      }

    }, 


    deleteHeaderBoxTemp: async(req,res)=>{
        try{
          const  {headerTempId} = req.body;
          const hid = parseInt(headerTempId);


          if(headerTempId == null){
            return res.status(400).send({ message: "missing_required_fields" });
          }

          const result = await prisma.$transaction(async (tx) => {

                // 5) ลบ temp ทั้งชุด (ลบจริง)
              const deleteAllBoxTemp  = await tx.boxReceiveTemp.deleteMany({
                  where: { headerId: hid },
                });

              const deleteHeaderTemp  = await tx.headerReceiveTemp.delete({
                  where: { id: hid },
                });

              return {
                deleteAllBoxTemp,
                deleteHeaderTemp
              };
          })

          return res.send({
            message: "delete_header_box_temp_success",
            data: result,
          });

        }catch(e){
          return res.status(500).send({ error: e.message });
        }
    },




//  **************  part Real *****************************************

    
createHeaderBox: async (req, res) => {
  try {
    const { userId, headTempId } = req.body;

    if (userId == null || headTempId == null) {
      return res.status(400).send({ message: "missing_required_fields" });
    }

    const uid = parseInt(userId);
    const hid = parseInt(headTempId);

   
  const genIssueLotNo = async (tx, dateRef) => {
      const d = new Date(dateRef);
      const pad2 = (n) => String(n).padStart(2, "0");

      const yy = String(d.getFullYear()).slice(-2); // 2 หลัก
      const mm = pad2(d.getMonth() + 1);
      const dd = pad2(d.getDate());

      // prefix ของวันนั้น (ไม่เว้นวรรค)
      const prefix = `${yy}${mm}${dd}`; // เช่น 260211

      // หา issueLotNo ล่าสุดของวันนั้น
      // ถ้าเก็บแบบมีเว้นวรรค ให้เปลี่ยน prefix เป็น `${yy} ${mm} ${dd} `
      const last = await tx.headerReceive.findFirst({
        where: {
          receiveLotNo: { startsWith: prefix },
          status: "use",
        },
        orderBy: { receiveLotNo: "desc" }, // string desc ใช้ได้ถ้า format fix-length
        select: { receiveLotNo: true },
      });

      let nextSeq = 1;

      if (last?.receiveLotNo) {
        // ดึง 3 หลักท้ายสุดเป็นเลขลำดับ
        const lastSeqStr = last.receiveLotNo.slice(-3); // "001" "023" ...
        const lastSeq = parseInt(lastSeqStr, 10);
        if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
      }

      const seqStr = String(nextSeq).padStart(3, "0"); // 001, 002, ...
      return `${prefix}${seqStr}`; // เช่น 260211001
     };



    const result = await prisma.$transaction(async (tx) => {
      // 1) ดึง header temp + vendor/controlLot + กล่อง temp
      const headerTemp = await tx.headerReceiveTemp.findFirst({
        where: { id: hid, status: "use" },
        include: {
          Vendor: { select: { id: true, name: true } },
          ControlLot: { select: { id: true, name: true } },
          BoxReceiveTemp: { where: { status: "use" } },
        },
      });

      if (!headerTemp) {
        throw new Error("headReceiveTemp_not_found");
      }

      // (แนะนำ) กัน user คนอื่นมากด Issue แทน
      if (headerTemp.userId !== uid) {
        throw new Error("forbidden_header_owner");
      }

      if (!headerTemp.BoxReceiveTemp || headerTemp.BoxReceiveTemp.length === 0) {
        throw new Error("boxReceiveTemp_not_found");
      }

      // 2) คำนวณ qtySum จากกล่องทั้งหมด
      const qtySum = headerTemp.BoxReceiveTemp.reduce(
        (sum, b) => sum + (Number(b.qty) || 0),
        0
      );

      const receiveLotNo = await genIssueLotNo(tx, headerTemp.receiveDateByUser);

      // 3) สร้าง HeaderIssue จริง
      const newHeader = await tx.headerReceive.create({
        data: {
          receiveLotNo,
          // sentDate จะ default now() อยู่แล้วตาม schema
          receiveDateByUser: headerTemp.receiveDateByUser,
          userId: headerTemp.userId,
          groupId: headerTemp.groupId,
          shift: headerTemp.shift,
          vender: headerTemp.Vendor?.name ?? String(headerTemp.venderId),
          controlLot: headerTemp.ControlLot?.name ?? String(headerTemp.controlLotId),
          itemNo: headerTemp.itemNo,
          itemName: headerTemp.itemName,
          qtyBox: headerTemp.qtyBox,
          qtySum: qtySum,
          lotState: "complete", // ปรับตาม business ของคุณได้ เช่น "issued" / "waiting_receive"
        },
      });

      // 4) สร้าง Box จริง (ย้ายจาก temp)
      // NOTE: lotNo ไม่มีใน Box schema => เก็บไว้ใน BoxState เพื่อไม่ให้หาย
      for (const b of headerTemp.BoxReceiveTemp) {
        await tx.box.updateMany({
          where: {
            receiveId: null,
            status: "use",
      
            // ใช้ field เหล่านี้จับคู่
            itemNo: b.itemNo,
            wosNo: b.wosNo,
            dieNo: b.dieNo,
            lotNo: b.lotNo,
          },
          data: {
            receiveId: newHeader.id,
            BoxState: "complete",
          },
        });
      }
      

      // 5) ลบ temp ทั้งชุด (ลบจริง)
      await tx.boxReceiveTemp.deleteMany({
        where: { headerId: hid },
      });

      await tx.headerReceiveTemp.delete({
        where: { id: hid },
      });

      return {
        header: newHeader,
        movedBoxCount: headerTemp.BoxReceiveTemp.length,
        qtySum,
      };
    });

    return res.send({
      message: "receive_create_header_box_success",
      data: result,
    });
  } catch (e) {
    // map error message ให้เป็น status ที่เหมาะสม
    const msg = String(e?.message || "");

    if (msg === "headReceiveTemp_not_found") {
      return res.status(404).send({ message: msg });
    }
    if (msg === "boxReceiveTemp_not_found") {
      return res.status(404).send({ message: msg });
    }
    if (msg === "forbidden_header_owner") {
      return res.status(403).send({ message: msg });
    }

    return res.status(500).send({ error: msg });
  }
},



list: async (req, res) => {
  try {

    // =============================
    // 1) ดึง HeaderIssue ก่อน
    // =============================
    const headers = await prisma.headerIssue.findMany({
      where: { status: 'use' },
      orderBy: { id: 'desc' },
      include: {
        User: true,
        Group: true,
      },
    });

    if (!headers.length) return res.send({ results: [] });

    // =============================
    // 2) ดึง Box ทีหลัง (chunk 500)
    // =============================
    const headerIds = headers.map(h => h.id);

    const chunkSize = 500;
    const allBoxes = [];

    for (let i = 0; i < headerIds.length; i += chunkSize) {
      const chunk = headerIds.slice(i, i + chunkSize);

      const boxes = await prisma.box.findMany({
        where: {
          status: 'use',
          issueId: { in: chunk },
        },
        orderBy: { id: 'asc' },
      });

      allBoxes.push(...boxes);
    }

    // =============================
    // 3) group box ตาม issueId
    // =============================
    const boxByIssueId = new Map();

    for (const b of allBoxes) {
      const arr = boxByIssueId.get(b.issueId) || [];
      arr.push(b);
      boxByIssueId.set(b.issueId, arr);
    }

    // =============================
    // 4) map output
    // =============================
    const results = headers.map(h => {

      const boxes = boxByIssueId.get(h.id) || [];

      return {
        id: h.id,
        issueLotNo: h.issueLotNo,

        sentDate: h.sentDate,
        sentDateByUser: h.sentDateByUser,

        userId: h.userId,
        userName: h.User?.name ?? null,
        userEmpNo: h.User?.empNo ?? null,

        groupId: h.groupId,
        groupName: h.Group?.name ?? null,

        shift: h.shift,
        vender: h.vender,
        controlLot: h.controlLot,

        itemNo: h.itemNo,
        itemName: h.itemName,

        qtyBox: h.qtyBox,
        qtySum: h.qtySum,

        lotState: h.lotState,

        boxes,               // ✅ attach box list
        boxCount: boxes.length,
      };
    });

    return res.send({ results });

  } catch (e) {
    return res.status(500).send({ error: e.message });
  }
},



}