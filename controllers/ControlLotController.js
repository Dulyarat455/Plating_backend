const {PrismaClient} = require('../generated/prisma');
const prisma = new PrismaClient();


module.exports = {

    add: async (req,res) =>{
        try{
            const  { role, name} = req.body;

            if (role !== "admin") {
                return res.status(400).send({ message: "Role_not_allowed" });
            }
            if (!name) {
              return res.status(400).send({ message: 'missing_required_fields' });
            }

            const checkControlLot = await prisma.controlLot.findFirst({
                where: {
                  name: name,
                  status: 'use',
                },
              });

              if (checkControlLot) {
                return res.status(400).send({ message: 'ControlLot_name_already' });
              }  


              const controlLot = await prisma.controlLot.create({
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
                message: 'add_controlLot_success',
                data: controlLot,
            });

        }catch(e){
            return res.status(500).send({ error: e.message });
        }
    },

    list: async (req, res) => {
      try{
          const rows = await prisma.controlLot.findMany({
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
        const existing = await prisma.controlLot.findFirst({
          where: { id: Number(id), status: 'use' }
        });

        if (!existing) {
          return res.status(404).send({ message: 'controlLot_not_found' });
        }

        // ตรวจสอบข้อมูลซ้ำ (ยกเว้น id ตัวเอง)
        const duplicate = await prisma.controlLot.findFirst({
          where: {
            id: { not: Number(id) },
            name,
            status: 'use'
          }
        });

        if (duplicate) {
          return res.status(400).send({ message: 'ControlLot_already' });
        }

        // update
        const updated = await prisma.controlLot.update({
          where: { id: Number(id) },
          data: {
            name,
          },
        });

        return res.send({
          message: 'edit_ControlLot_success',
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
  
      const existing = await prisma.controlLot.findFirst({
        where: { id: Number(id), status: 'use' }
      });
  
      if (!existing) {
        return res.status(404).send({ message: 'ControlLot_not_found' });
      }
  
      await prisma.controlLot.update({
        where: { id: Number(id) },
        data: { status: 'delete' }
      });
  
      return res.send({
        message: 'delete_controlLot_success'
      });
        
    }catch(e){
      return res.status(500).send({ error: e.message });

    }
}



}