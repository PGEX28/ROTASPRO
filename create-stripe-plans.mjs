import Stripe from 'stripe'

// Pegando a chave de producao que voce acabou de colar no .env.local
const skLive = "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";
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
