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



}