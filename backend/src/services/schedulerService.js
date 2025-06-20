import cron from 'node-cron';
import Booking from '../models/Booking.js';
import {sendWhatsAppConfirmation}  from './evolutionWhatsapp.js';
import { startOfDay, endOfDay } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { formatPhoneNumber } from '../utils/phoneFormater.js';	

const BRAZIL_TZ = 'America/Sao_Paulo';

// Função para buscar agendamentos do dia e enviar lembretes
const sendDailyReminders = async () => {
  const now = new Date();
  const nowInBrazil = toZonedTime(now, BRAZIL_TZ);

  // Obter início e fim do dia no fuso horário do Brasil
  const startOfDayBrazil = startOfDay(nowInBrazil);
  const endOfDayBrazil = endOfDay(nowInBrazil);
  
  // Converter de volta para UTC para consulta no banco
  const start = fromZonedTime(startOfDayBrazil, BRAZIL_TZ);
  const end = fromZonedTime(endOfDayBrazil, BRAZIL_TZ);

  try {
    const bookings = await Booking.find({
      time: {
        $gte: start,
        $lt: end,
      },
      status: 'booked',
    })
      .populate('barber')
      .populate('barbershop');

    if (bookings.length === 0) {
      console.log('Nenhum agendamento para hoje.');
      return;
    }

    console.log(`${bookings.length} agendamentos encontrados para hoje. Enviando lembretes...`);

    for (const booking of bookings) {
      const customerPhone = booking.customer.phone;
      const appointmentTimeInBrazil = toZonedTime(new Date(booking.time), BRAZIL_TZ);
      const appointmentTime = appointmentTimeInBrazil.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      const barberName = booking.barber ? booking.barber.name : 'seu barbeiro';
      const barberShopName = booking.barbershop ? booking.barbershop.name : 'barbearia';
      const barberShopContact = formatPhoneNumber(booking.barbershop.contact);
      const barberShopAdress = booking.barbershop.address ? `${booking.barbershop.address.rua}, ${booking.barbershop.address.numero} - ${booking.barbershop.address.bairro}` : '';

      const message = `Bom dia, ${booking.customer.name}! Lembrete do seu agendamento hoje na ${barberShopName} às ${appointmentTime} com ${barberName} ✅\n\nPara mais informações, entre em contato com a barbearia: ${barberShopContact} 📱\nEndereço: ${barberShopAdress}💈`;

      await sendWhatsAppConfirmation(customerPhone, message);

      console.log(`Mensagem enviada para ${booking.customer.name} (${customerPhone})`);
    }

  } catch (error) {
    console.error('Erro ao enviar lembretes de agendamento:', error);
  }
};

// Agenda a tarefa para ser executada todos os dias às 8h da manhã
cron.schedule('0 8 * * *', () => {
  console.log('Executando tarefa agendada: Envio de lembretes de agendamento.');
  sendDailyReminders();
}, {
  scheduled: true,
  timezone: "America/Sao_Paulo" // Defina o fuso horário correto
});

console.log('Serviço de agendamento de lembretes iniciado.');