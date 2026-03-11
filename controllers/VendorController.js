const {PrismaClient} = require('../generated/prisma');
const { edit } = require('./SectionController');
const prisma = new PrismaClient();


module.exports = {

    add: async (req,res) =>{
        try{
            const  {role, name} =  req.body;

            if (role !== "admin") {
                return res.status(400).send({ message: "Role_not_allowed" });
            }
            if (!name) {
              return res.status(400).send({ message: 'missing_required_fields' });
            }

            const checkVendor = await prisma.vendor.findFirst({
                where: {
                  name: name,
                  status: 'use',
                },
              });

              if (checkVendor) {
                return res.status(400).send({ message: 'vendor_name_already' });
              }  


              const vendor = await prisma.vendor.create({
                data: {
                  name: name
                },
                select: {
                  id: true,
                  name: true,
                  status: true,
                },
              });

            return res.send({
                message: 'add_vendor_success',
                data: vendor,
            });


        }catch(e){
            return res.status(500).send({ error: e.message });
        }

    },

    list: async (req, res) => {
      try{
          const rows = await prisma.vendor.findMany({
              where: {
                status: 'use'
              }
          })
          return res.send({ results: rows })
  
      }catch(e){
          return res.status(500).send({ error: e.message });
      }
  
    },



    edit: async (req,res)=>{
        try{

          const { id, name } = req.body;
    
          if (id == null) {
            return res.status(400).send({ message: 'missing_id' });
          }
  
          if (
            name == null 
          ) {
            return res.status(400).send({ message: 'missing_required_fields' });
          }
  
          // ตรวจสอบว่ามี record นี้อยู่ไหม
          const existing = await prisma.vendor.findFirst({
            where: { id: Number(id), status: 'use' }
          });
  
          if (!existing) {
            return res.status(404).send({ message: 'vendor_not_found' });
          }
  
          // ตรวจสอบข้อมูลซ้ำ (ยกเว้น id ตัวเอง)
          const duplicate = await prisma.vendor.findFirst({
            where: {
              id: { not: Number(id) },
              name,
              status: 'use'
            }
          });
  
          if (duplicate) {
            return res.status(400).send({ message: 'vendor_already' });
          }
  
          // update
          const updated = await prisma.vendor.update({
            where: { id: Number(id) },
            data: {
              name,
            },
          });
  
          return res.send({
            message: 'edit_vendor_success',
            data: {
              id: updated.id,
              name: updated.name,
            }
          });


        }catch(e){
          return res.status(500).send({ error: e.message });

        }
    },


    delete: async (req,res)=>{
      try{
        const { id } = req.body;
        
        if (!id) {
          return res.status(400).send({ message: 'missing_id' });
        }
    
        const existing = await prisma.vendor.findFirst({
          where: { id: Number(id), status: 'use' }
        });
    
        if (!existing) {
          return res.status(404).send({ message: 'vendor_not_found' });
        }
    
        await prisma.vendor.update({
          where: { id: Number(id) },
          data: { status: 'delete' }
        });
    
        return res.send({
          message: 'delete_vendor_success'
        });
          
      }catch(e){
        return res.status(500).send({ error: e.message });

      }
  }

}
