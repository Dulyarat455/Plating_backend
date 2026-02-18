const {PrismaClient} = require('../generated/prisma');
const prisma = new PrismaClient();
const dotenv = require('dotenv')
const jwt = require('jsonwebtoken')



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

      

      


}

