const {PrismaClient} = require('../generated/prisma');
const prisma = new PrismaClient();
const dotenv = require('dotenv')
const jwt = require('jsonwebtoken')

const ExcelJS = require('exceljs');



module.exports = {

    create: async(req,res)=>{
        try{
            const { role, rfId, name, empNo, password, groupId, sectionId } = req.body ;

            if (
                role == null ||
                rfId == null ||
                name == null ||
                empNo == null ||
                password == null  ||
                groupId == null ||
                sectionId == null
              ) {
                return res.status(400).send({ message: 'missing_required_fields' });
              }

              // check account 

              const existUser = await prisma.user.findFirst({
                where: {
                  OR: [
                    { empNo },
                    {name},
                    rfId ? { rfId } : undefined,
                  ].filter(Boolean),
                },
              });
              if (existUser) {
                return res.status(400).send({
                  message: 'user_already_exists',
                  detail: {
                    empNo: existUser.empNo === empNo,
                    name: existUser.name === name,
                    rfId: rfId ? existUser.rfId === rfId : false,
                  },
                });
              }



              const result =  await prisma.$transaction(async (tx)=> {
                
                const user =  await tx.user.create({
                    data:{
                        name: name,
                        password: password,
                        role: role,
                        rfId: rfId,
                        empNo: empNo,
                    }
                })

                const mapGroupSection = await tx.mapGroupSection.create({
                    data:{
                        userId: Number(user.id),
                        groupId: Number(groupId),
                        sectionId: Number(sectionId),
                    }
                })

                return {user, mapGroupSection}

              })

            return res.send({ message: "Add user success",...result });
        }catch(e){
            return res.status(500).send({ error: e.message });
        }

    },


    signin: async (req, res) => {
        try {
          const { empNo, password } = req.body;
    
          if (!empNo || !password) {
            return res.status(400).send({ message: 'missing_empNo_or_password' });
          }
    
          // ✅ หา user + map + group/section (ใช้ schema ปัจจุบัน: status เท่านั้น)
          const u = await prisma.user.findFirst({
            where: {
              empNo: String(empNo).trim(),
              password: String(password),
              status: 'use',
            },
            include: {
              MapGroupSection: {
                where: { status: 'use' },
                include: {
                  Group: true,
                  Section: true,
                },
                orderBy: { id: 'desc' }, // เอา mapping ล่าสุด (ปรับได้)
              },
            },
          });
    
          if (!u) {
            return res.status(401).send({ message: 'unauthorized' });
          }
    
          // ✅ เลือก mapping แรก (ล่าสุด)
          const m = u.MapGroupSection?.[0] || null;
          const group = m?.Group || null;
          const section = m?.Section || null;
    
          // ✅ payload (ไม่มี accountState เพราะ schema ไม่มี)
          const payload = {
            id: u.id,
            empNo: u.empNo,
            name: u.name,
            role: u.role,
            rfId: u.rfId,
            status: u.status,
    
            groupId: group?.id ?? null,
            groupName: group?.name ?? null,
    
            sectionId: section?.id ?? null,
            sectionName: section?.name ?? null,
          };
    
          const key = process.env.SECRET_KEY;
          if (!key) {
            return res.status(500).send({ message: 'missing_SECRET_KEY' });
          }
    
          const token = jwt.sign(
            {
              id: payload.id,
              empNo: payload.empNo,
              role: payload.role,
              name: payload.name,
              groupId: payload.groupId,
              sectionId: payload.sectionId,
            },
            key,
            { expiresIn: '30d' }
          );
    
          return res.send({ token, ...payload });
        } catch (e) {
          console.error(e);
          return res.status(500).send({ error: e.message });
        }
      },
      
      upadate: async (req, res) => {
          try{

          }catch(e) {
           
            return res.status(500).send({ error: e.message });
          }

      },


      signInRfId: async (req, res) => {
        try{
          const {rfId} = req.body;
          
          if ( rfId == null ) {
              return res.status(400).send({ message: 'missing_required_fields' });
          }

          const u = await prisma.user.findFirst({
            where: {
              rfId: rfId ,
              status: 'use',
            },
            include: {
              MapGroupSection: {
                where: { status: 'use' },
                include: {
                  Group: true,
                  Section: true,
                },
                orderBy: { id: 'desc' }, // เอา mapping ล่าสุด (ปรับได้)
              },
            },
          });       
          
          
          if(!u){
            return res.status(401).send({ message: 'unauthorized' });
          }


           // ✅ เลือก mapping แรก (ล่าสุด)
           const m = u.MapGroupSection?.[0] || null;
           const group = m?.Group || null;
           const section = m?.Section || null;
     
           const payload = {
            id: u.id,
            empNo: u.empNo,
            name: u.name,
            role: u.role,
            rfId: u.rfId,
            status: u.status,
    
            groupId: group?.id ?? null,
            groupName: group?.name ?? null,
    
            sectionId: section?.id ?? null,
            sectionName: section?.name ?? null,
          };


          const key = process.env.SECRET_KEY;
          if (!key) {
            return res.status(500).send({ message: 'missing_SECRET_KEY' });
          }
    
          const token = jwt.sign(
            {
              id: payload.id,
              empNo: payload.empNo,
              role: payload.role,
              name: payload.name,
              groupId: payload.groupId,
              sectionId: payload.sectionId,
            },
            key,
            { expiresIn: '30d' }
          );
    
          return res.send({ token, ...payload });
        }catch(e){
          return res.status(500).send({ error: e.message });
        }

      },




      list: async (req, res) => {
        try {
          // =============================
          // 1) Users + map group/section (เอาอันแรกสุดเป็นหลัก)
          // =============================
          const users = await prisma.user.findMany({
            where: { status: 'use' },
            orderBy: { id: 'asc' },
            select: {
              id: true,
              empNo: true,
              name: true,
              role: true,
              rfId: true,
              password: true,
              MapGroupSection: {
                where: { status: 'use' },
                orderBy: { id: 'asc' },
                select: {
                  groupId: true,
                  sectionId: true,
                  Group: { select: { name: true } },
                  Section: { select: { name: true } },
                }
              }
            }
          });

          if (!users.length) return res.send({ results: [] });

          const userIds = users.map(u => u.id);
          const chunkSize = 500;

          // =============================
          // 2) IssueTemp (chunk) + BoxIssueTemp (wosNo)
          // =============================
          const issueAll = [];
          for (let i = 0; i < userIds.length; i += chunkSize) {
            const chunk = userIds.slice(i, i + chunkSize);

            const rows = await prisma.headerIssueTemp.findMany({
              where: { status: 'use', userId: { in: chunk } },
              orderBy: { id: 'desc' }, // ✅ ล่าสุดก่อน
              select: {
                id: true,
                userId: true,
                shift: true,
                itemNo: true,
                itemName: true,
                sentDate: true,
                Vendor: { select: { name: true } },
                ControlLot: { select: { name: true } },
                BoxIssueTemp: {
                  where: { status: 'use' },
                  select: { wosNo: true }
                }
              }
            });

            issueAll.push(...rows);
          }

          // group issue by userId
          const issueByUserId = new Map();
          for (const h of issueAll) {
            const arr = issueByUserId.get(h.userId) || [];
            arr.push(h);
            issueByUserId.set(h.userId, arr);
          }

          // =============================
          // 3) ReceiveTemp (chunk) + BoxReceiveTemp (wosNo)
          // =============================
          const receiveAll = [];
          for (let i = 0; i < userIds.length; i += chunkSize) {
            const chunk = userIds.slice(i, i + chunkSize);

            const rows = await prisma.headerReceiveTemp.findMany({
              where: { status: 'use', userId: { in: chunk } },
              orderBy: { id: 'desc' }, // ✅ ล่าสุดก่อน
              select: {
                id: true,
                userId: true,
                shift: true,
                itemNo: true,
                itemName: true,
                receiveDate: true,
                Vendor: { select: { name: true } },
                ControlLot: { select: { name: true } },
                BoxReceiveTemp: {
                  where: { status: 'use' },
                  select: { wosNo: true }
                }
              }
            });

            receiveAll.push(...rows);
          }

          // group receive by userId
          const receiveByUserId = new Map();
          for (const h of receiveAll) {
            const arr = receiveByUserId.get(h.userId) || [];
            arr.push(h);
            receiveByUserId.set(h.userId, arr);
          }

          // =============================
          // 4) flatten output ตาม Example
          //    - เอา "งานค้างล่าสุด" ของ issue/receive ของ user นั้น
          // =============================
          const results = users.map(u => {
            const map0 = (u.MapGroupSection || [])[0] || null;

            const issueLatest = (issueByUserId.get(u.id) || [])[0] || null;     // ✅ ล่าสุด
            const receiveLatest = (receiveByUserId.get(u.id) || [])[0] || null; // ✅ ล่าสุด

            const issueWos = issueLatest
              ? Array.from(new Set((issueLatest.BoxIssueTemp || []).map(b => b.wosNo).filter(Boolean)))
              : [];

            const receiveWos = receiveLatest
              ? Array.from(new Set((receiveLatest.BoxReceiveTemp || []).map(b => b.wosNo).filter(Boolean)))
              : [];

            return {
              id: u.id,
              empNo: u.empNo,
              name: u.name,
              role: u.role,
              rfId: u.rfId,
              password: u.password,

              groupId: map0?.groupId ?? null,
              groupName: map0?.Group?.name ?? null,
              sectionId: map0?.sectionId ?? null,
              sectionName: map0?.Section?.name ?? null,

              issue: {
                hasPending: !!issueLatest,
                itemNo: issueLatest?.itemNo ?? '',
                itemName: issueLatest?.itemName ?? '',
                shift: issueLatest?.shift ?? '',
                sentDate: issueLatest?.sentDate ?? '',
                vendorName: issueLatest?.Vendor?.name ?? '',
                controlLotName: issueLatest?.ControlLot?.name ?? '',
                boxCount: issueWos.length,   // ✅ จำนวน wosNo ไม่ซ้ำ (หรือถ้าอยากเป็นจำนวน box จริง ใช้ BoxIssueTemp.length)
                wosNos: issueWos,
              },

              receive: {
                hasPending: !!receiveLatest,
                itemNo: receiveLatest?.itemNo ?? '',
                itemName: receiveLatest?.itemName ?? '',
                shift: receiveLatest?.shift ?? '',
                sentDate: receiveLatest?.receiveDate ?? '', // ✅ map เป็น sentDate ให้ตรง Example
                vendorName: receiveLatest?.Vendor?.name ?? '',
                controlLotName: receiveLatest?.ControlLot?.name ?? '',
                boxCount: receiveWos.length,
                wosNos: receiveWos,
              }
            };
          });

          return res.send({ results });

        } catch (e) {
          return res.status(500).send({ error: e.message });
        }
},



exportExcel: async (req, res) => {
  try {
    // =============================
    // helpers (อยู่ใน function นี้ทั้งหมด)
    // =============================
    const chunkSize = 500;

    const chunkArray = (arr, size) => {
      const out = [];
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
      return out;
    };

    const safeStr = (v) => (v == null ? '' : String(v));

    const norm = (v) => safeStr(v).trim();
    const normLower = (v) => norm(v).toLowerCase();

    // =============================
    // 0) read filters
    // =============================
    const { filters } = req.body || {};

    const empNoQ       = norm(filters?.empNo);
    const nameQ        = norm(filters?.name);
    const roleQ        = norm(filters?.role);          // 'all' หรือ 'admin'/'user'
    const groupQ       = norm(filters?.groupName);     // ใช้ groupName (จาก dropdown หน้าเว็บ)
    const sectionQ     = norm(filters?.sectionName);   // ใช้ sectionName
    const onProcessQ   = normLower(filters?.onProcess) || 'all'; // all|none|issue|receive|both

    // =============================
    // 1) fetch users (base filter) + map group/section (เอาอันแรก)
    // =============================
    const whereUser = { status: 'use' };

    if (empNoQ) whereUser.empNo = { contains: empNoQ };
    if (nameQ)  whereUser.name  = { contains: nameQ };
    if (roleQ && roleQ !== 'all') whereUser.role = roleQ;

    const users = await prisma.user.findMany({
      where: whereUser,
      orderBy: { id: 'asc' },
      select: {
        id: true,
        empNo: true,
        name: true,
        role: true,
        rfId: true,
        password: true, // ✅ export ต้องมี
        MapGroupSection: {
          where: { status: 'use' },
          orderBy: { id: 'asc' }, // ✅ เอาอันแรกเป็นหลัก
          select: {
            groupId: true,
            sectionId: true,
            Group: { select: { name: true } },
            Section: { select: { name: true } },
          }
        }
      }
    });

    if (!users.length) {
      // คืนไฟล์ excel ว่างก็ได้ หรือส่ง msg ก็ได้
      const wbEmpty = new ExcelJS.Workbook();
      const wsEmpty = wbEmpty.addWorksheet('Members');
      wsEmpty.columns = [
        { header: 'EmpNo', key: 'empNo', width: 14 },
        { header: 'RFID', key: 'rfId', width: 18 },
        { header: 'Name', key: 'name', width: 28 },
        { header: 'Role', key: 'role', width: 10 },
        { header: 'Group', key: 'groupName', width: 16 },
        { header: 'Section', key: 'sectionName', width: 16 },
        { header: 'Password', key: 'password', width: 16 },
      ];
      wsEmpty.getRow(1).font = { bold: true };

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Members.xlsx"`);
      await wbEmpty.xlsx.write(res);
      return res.end();
    }

    const userIds = users.map(u => u.id);

    // =============================
    // 2) หา on-process (IssueTemp / ReceiveTemp) แบบ chunk
    //    - เอาแค่ "มี/ไม่มี" ก็พอสำหรับ filter + badge
    // =============================
    const issueSet = new Set();   // userId ที่มี issue ค้าง
    const recvSet  = new Set();   // userId ที่มี receive ค้าง

    for (const chunk of chunkArray(userIds, chunkSize)) {
      const issueRows = await prisma.headerIssueTemp.findMany({
        where: { status: 'use', userId: { in: chunk } },
        select: { userId: true },
      });
      for (const r of issueRows) issueSet.add(r.userId);

      const recvRows = await prisma.headerReceiveTemp.findMany({
        where: { status: 'use', userId: { in: chunk } },
        select: { userId: true },
      });
      for (const r of recvRows) recvSet.add(r.userId);
    }

    // =============================
    // 3) flatten + apply filters (group/section/onProcess)
    // =============================
    const rowsAll = users.map(u => {
      const map0 = (u.MapGroupSection || [])[0] || null;

      const hasIssue   = issueSet.has(u.id);
      const hasReceive = recvSet.has(u.id);

      let onProcess = 'none';
      if (hasIssue && hasReceive) onProcess = 'both';
      else if (hasIssue) onProcess = 'issue';
      else if (hasReceive) onProcess = 'receive';

      return {
        id: u.id,
        empNo: u.empNo,
        rfId: u.rfId,
        name: u.name,
        role: u.role,
        password: u.password,

        groupName: map0?.Group?.name ?? '',
        sectionName: map0?.Section?.name ?? '',

        onProcess,
        hasIssue,
        hasReceive,
      };
    });

    // filter group/section (ทำหลัง flatten เพราะเราใช้ "ตัวแรก" ของ MapGroupSection)
    let rows = rowsAll;

    if (groupQ && groupQ !== 'all') {
      const gNeed = groupQ;
      rows = rows.filter(r => safeStr(r.groupName) === gNeed);
    }

    if (sectionQ && sectionQ !== 'all') {
      const sNeed = sectionQ;
      rows = rows.filter(r => safeStr(r.sectionName) === sNeed);
    }

    // filter onProcess
    if (onProcessQ && onProcessQ !== 'all') {
      rows = rows.filter(r => r.onProcess === onProcessQ);
    }

    // =============================
    // 4) create excel
    // =============================
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Members');

    ws.columns = [
      { header: 'EmpNo', key: 'empNo', width: 14 },
      { header: 'RFID', key: 'rfId', width: 18 },
      { header: 'Name', key: 'name', width: 28 },
      { header: 'Role', key: 'role', width: 10 },
      { header: 'Group', key: 'groupName', width: 16 },
      { header: 'Section', key: 'sectionName', width: 16 },
      { header: 'Password', key: 'password', width: 18 },
    ];

    ws.getRow(1).font = { bold: true };

    for (const r of rows) {
      ws.addRow({
        empNo: safeStr(r.empNo),
        rfId: safeStr(r.rfId),
        name: safeStr(r.name),
        role: safeStr(r.role),
        groupName: safeStr(r.groupName),
        sectionName: safeStr(r.sectionName),
        password: safeStr(r.password),
      });
    }

    // =============================
    // 5) response file
    // =============================
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Members.xlsx"`);

    await wb.xlsx.write(res);
    return res.end();

  } catch (e) {
    return res.status(500).send({ error: e.message });
  }
},



importExcel: async (req, res) => {
  try {
    // -------------------------
    // 0) validate file
    // -------------------------
    const file = req.file;
    if (!file) {
      return res.status(400).send({ message: 'missing_file' });
    }

    // -------------------------
    // helper (อยู่ใน function)
    // -------------------------
    const chunkSize = 500;

    const safeStr = (v) => (v == null ? '' : String(v));
    const normKey = (s) => safeStr(s).trim().toLowerCase();
    const normVal = (s) => safeStr(s).trim(); // keep case for name/password but trim
    const normEmp = (s) => safeStr(s).trim().toUpperCase();
    const normNameKey = (s) => safeStr(s).trim().toLowerCase();
    const normRfid = (s) => safeStr(s).trim();

    // -------------------------
    // 1) load workbook
    // -------------------------
    const wb = new ExcelJS.Workbook();

    // multer memoryStorage -> file.buffer มี
    // ถ้าใช้ diskStorage -> file.path
    if (file.buffer) {
      await wb.xlsx.load(file.buffer);
    } else if (file.path) {
      await wb.xlsx.readFile(file.path);
    } else {
      return res.status(400).send({ message: 'invalid_upload' });
    }

    const ws = wb.worksheets[0];
    if (!ws) return res.status(400).send({ message: 'sheet_not_found' });

    // -------------------------
    // 2) map header columns
    // -------------------------
    const headerRow = ws.getRow(1);
    const colMap = {}; // { empno: 1, rfid: 2, ... }

    headerRow.eachCell((cell, colNumber) => {
      const k = normKey(cell.value);
      if (!k) return;
      colMap[k] = colNumber;
    });

    // required headers
    const need = ['empno', 'rfid', 'name', 'role', 'group', 'section', 'password'];
    const missing = need.filter(k => !colMap[k]);
    if (missing.length) {
      return res.status(400).send({
        message: 'missing_header',
        missing
      });
    }

    // -------------------------
    // 3) preload Group / Section (name -> id)
    // -------------------------
    const groups = await prisma.group.findMany({
      where: { status: 'use' },
      select: { id: true, name: true }
    });
    const sections = await prisma.section.findMany({
      where: { status: 'use' },
      select: { id: true, name: true }
    });

    const groupByName = new Map();   // lower(name) -> id
    const sectionByName = new Map(); // lower(name) -> id
    for (const g of groups) groupByName.set(normNameKey(g.name), g.id);
    for (const s of sections) sectionByName.set(normNameKey(s.name), s.id);

    // -------------------------
    // 4) preload existing users for fast duplicate check
    // -------------------------
    const existingUsers = await prisma.user.findMany({
      where: { status: 'use' },
      select: { empNo: true, name: true, rfId: true }
    });

    const existEmp = new Set(existingUsers.map(u => normEmp(u.empNo)));
    const existName = new Set(existingUsers.map(u => normNameKey(u.name)));
    const existRfid = new Set(existingUsers.map(u => normRfid(u.rfId)));

    // also check duplicate inside file
    const seenEmp = new Set();
    const seenName = new Set();
    const seenRfid = new Set();

    // -------------------------
    // 5) read rows
    // -------------------------
    const toInsert = [];
    const invalidRows = [];
    const duplicates = [];

    const lastRow = ws.rowCount;

    for (let r = 2; r <= lastRow; r++) {
      const row = ws.getRow(r);

      const empNo = normEmp(row.getCell(colMap['empno']).value);
      const rfId = normRfid(row.getCell(colMap['rfid']).value);
      const name = normVal(row.getCell(colMap['name']).value);
      const role = normVal(row.getCell(colMap['role']).value);
      const groupName = normVal(row.getCell(colMap['group']).value);
      const sectionName = normVal(row.getCell(colMap['section']).value);
      const password = normVal(row.getCell(colMap['password']).value);

      // empty line skip
      if (!empNo && !name && !rfId) continue;

      // validate required
      const reasons = [];
      if (!empNo) reasons.push('missing_empNo');
      if (!rfId) reasons.push('missing_rfId');
      if (!name) reasons.push('missing_name');
      if (!role) reasons.push('missing_role');
      if (!groupName) reasons.push('missing_group');
      if (!sectionName) reasons.push('missing_section');
      if (!password) reasons.push('missing_password');

      const groupId = groupByName.get(normNameKey(groupName)) || null;
      const sectionId = sectionByName.get(normNameKey(sectionName)) || null;

      if (!groupId) reasons.push('group_not_found');
      if (!sectionId) reasons.push('section_not_found');

      if (reasons.length) {
        invalidRows.push({
          row: r,
          empNo,
          rfId,
          name,
          role,
          group: groupName,
          section: sectionName,
          reason: reasons.join(', ')
        });
        continue;
      }

      // duplicate check (DB)
      const keyEmp = empNo;
      const keyName = normNameKey(name);
      const keyRfid = rfId;

      const dupDB =
        existEmp.has(keyEmp) ||
        existName.has(keyName) ||
        existRfid.has(keyRfid);

      // duplicate check (file)
      const dupFile =
        seenEmp.has(keyEmp) ||
        seenName.has(keyName) ||
        seenRfid.has(keyRfid);

      if (dupDB || dupFile) {
        duplicates.push({
          row: r,
          empNo,
          rfId,
          name,
          reason: dupDB ? 'duplicate_in_db' : 'duplicate_in_file'
        });
        continue;
      }

      // mark seen
      seenEmp.add(keyEmp);
      seenName.add(keyName);
      seenRfid.add(keyRfid);

      toInsert.push({
        empNo,
        rfId,
        name,
        role,
        password,
        groupId,
        sectionId,
        rowNo: r,
        groupName,
        sectionName
      });
    }

    // -------------------------
    // 6) insert (transaction per row)
    // -------------------------
    let inserted = 0;
    const insertErrors = [];

    // ทำเป็น chunk 500 (ตามที่คุณชอบ)
    for (let i = 0; i < toInsert.length; i += chunkSize) {
      const chunk = toInsert.slice(i, i + chunkSize);

      for (const item of chunk) {
        try {
          await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
              data: {
                empNo: item.empNo,
                rfId: item.rfId,
                name: item.name,
                role: item.role,
                password: item.password
              }
            });

            await tx.mapGroupSection.create({
              data: {
                userId: user.id,
                groupId: Number(item.groupId),
                sectionId: Number(item.sectionId)
              }
            });
          });

          inserted++;

          // เพิ่มเข้า exist set กันซ้ำในแถวถัดไป (กรณี chunk ถัดไป)
          existEmp.add(item.empNo);
          existName.add(normNameKey(item.name));
          existRfid.add(item.rfId);

        } catch (e) {
          insertErrors.push({
            row: item.rowNo,
            empNo: item.empNo,
            name: item.name,
            reason: e?.message || 'insert_failed'
          });
        }
      }
    }

    // -------------------------
    // 7) response summary
    // -------------------------
    return res.send({
      summary: {
        totalRows: Math.max(0, lastRow - 1),
        parsed: toInsert.length + invalidRows.length + duplicates.length,
        inserted,
        skippedDuplicate: duplicates.length,
        invalid: invalidRows.length,
        insertFailed: insertErrors.length
      },
      duplicates,
      invalidRows,
      insertErrors
    });

  } catch (e) {
    return res.status(500).send({ error: e.message });
  }
},

      


// check action HeaderIssueTemp, HeaderReceiveTemp
delete: async (req, res) => {
  try {
    const { id } = req.body || {};

    if (!id) {
      return res.status(400).send({ message: 'missing_id' });
    }

    const userId = Number(id);

    // 1) เช็ค user มีจริงไหม
    const existing = await prisma.user.findFirst({
      where: { id: userId, status: 'use' },
      select: { id: true, empNo: true, name: true }
    });

    if (!existing) {
      return res.status(404).send({ message: 'user_not_found' });
    }

    // 2) เช็คงานค้าง (IssueTemp / ReceiveTemp)
    // ใช้ count เบาและเร็วกว่า findMany
    const [issueCount, receiveCount] = await Promise.all([
      prisma.headerIssueTemp.count({
        where: { status: 'use', userId }
      }),
      prisma.headerReceiveTemp.count({
        where: { status: 'use', userId }
      }),
    ]);

    if (issueCount > 0 || receiveCount > 0) {
      return res.status(400).send({
        message: 'cannot_delete_user_has_pending',
        detail: {
          userId,
          empNo: existing.empNo,
          name: existing.name,
          issuePendingCount: issueCount,
          receivePendingCount: receiveCount,
        }
      });
    }

    // 3) ไม่มีงานค้าง -> soft delete
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'delete' }
    });

    return res.send({
      message: 'delete_user_success',
      userId
    });

  } catch (e) {
    return res.status(500).send({ error: e.message });
  }
},




edit: async (req, res) => {
  try {
    const {
      id,
      empNo,
      name,
      role,
      rfId,
      password,
      groupId,
      sectionId
    } = req.body || {};

    // =============================
    // 0) validate required fields
    // =============================
    if (
      id == null ||
      empNo == null ||
      name == null ||
      role == null ||
      rfId == null ||
      password == null ||
      groupId == null ||
      sectionId == null
    ) {
      return res.status(400).send({ message: 'missing_required_fields' });
    }

    const userId = Number(id);
    const empNoStr = String(empNo).trim();
    const nameStr = String(name).trim();
    const roleStr = String(role).trim();
    const rfIdStr = String(rfId).trim();
    const passwordStr = String(password); // ไม่ trim ก็ได้ แล้วแต่ policy
    const groupIdNum = Number(groupId);
    const sectionIdNum = Number(sectionId);

    if (!userId || !empNoStr || !nameStr || !roleStr || !rfIdStr || !passwordStr || !groupIdNum || !sectionIdNum) {
      return res.status(400).send({ message: 'missing_required_fields' });
    }

    // =============================
    // 1) check user exists
    // =============================
    const existing = await prisma.user.findFirst({
      where: { id: userId, status: 'use' },
      select: { id: true, empNo: true, name: true, rfId: true }
    });

    if (!existing) {
      return res.status(404).send({ message: 'user_not_found' });
    }

    // =============================
    // 2) check duplicate (exclude self)
    // =============================
    const duplicate = await prisma.user.findFirst({
      where: {
        id: { not: userId },
        status: 'use',
        OR: [
          { empNo: empNoStr },
          { name: nameStr },
          { rfId: rfIdStr }
        ]
      },
      select: { empNo: true, name: true, rfId: true }
    });

    if (duplicate) {
      return res.status(400).send({
        message: 'user_already_exists',
        detail: {
          empNo: duplicate.empNo === empNoStr,
          name: duplicate.name === nameStr,
          rfId: duplicate.rfId === rfIdStr
        }
      });
    }

    // =============================
    // 3) ✅ check pending Issue/Receive temp
    //    ถ้ามีงานค้าง -> ไม่ให้แก้
    // =============================
    const [issueTempCnt, receiveTempCnt] = await Promise.all([
      prisma.headerIssueTemp.count({
        where: { status: 'use', userId }
      }),
      prisma.headerReceiveTemp.count({
        where: { status: 'use', userId }
      })
    ]);

    if (issueTempCnt > 0 || receiveTempCnt > 0) {
      return res.status(400).send({
        message: 'user_has_pending_transaction',
        detail: {
          issue: issueTempCnt,
          receive: receiveTempCnt
        }
      });
    }

    // =============================
    // 4) update user + map group/section (transaction)
    // =============================
    const result = await prisma.$transaction(async (tx) => {
      // 4.1 update user
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          empNo: empNoStr,
          name: nameStr,
          role: roleStr,
          rfId: rfIdStr,
          password: passwordStr
        }
      });

      // 4.2 หา map เดิม (ใช้ตัวแรกที่ status use)
      const mapOld = await tx.mapGroupSection.findFirst({
        where: { userId, status: 'use' },
        orderBy: { id: 'asc' },
        select: { id: true }
      });

      if (mapOld) {
        // update map เดิม
        await tx.mapGroupSection.update({
          where: { id: mapOld.id },
          data: {
            groupId: groupIdNum,
            sectionId: sectionIdNum
          }
        });
      } else {
        // create ใหม่ถ้าไม่เคยมี map
        await tx.mapGroupSection.create({
          data: {
            userId,
            groupId: groupIdNum,
            sectionId: sectionIdNum
          }
        });
      }

      return user;
    });

    return res.send({
      message: 'edit_user_success',
      data: result
    });

  } catch (e) {
    return res.status(500).send({ error: e.message });
  }
},





}

