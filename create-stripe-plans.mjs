import Stripe from 'stripe'

// Pegando a chave do ambiente para segurança
const skLive = process.env.STRIPE_SECRET_KEY;
if (!skLive) {
  console.error("ERRO: STRIPE_SECRET_KEY não encontrada no ambiente.");
  process.exit(1);
}
const stripe = new Stripe(skLive);

async function main() {
  console.log('Iniciando criacao dos produtos Live...');

  const plans = [
    { name: 'Piloto', price: 1000 }, // R$ 10,00 * 100 = 1000 centavos
    { name: 'Básico', price: 2500 },
    { name: 'Profissional', price: 5000 },
    { name: 'Frota / Top', price: 10000 }
  ];

  for (const plan of plans) {
    try {
      console.log(`\nCriando produto: ${plan.name} ...`);
      const product = await stripe.products.create({
        name: plan.name,
      });

      console.log(`Criando preco padrao para: ${plan.name} ...`);
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.price,
        currency: 'brl',
      });

      console.log(`SUCESSO -> ${plan.name}: ${price.id}`);
    } catch (err) {
      console.error(`Erro no plano ${plan.name}: `, err.message);
    }
  }
}

main();
