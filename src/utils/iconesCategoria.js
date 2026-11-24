import {
  Tag, Utensils, Coffee, ShoppingCart, ShoppingBag, Home, Car, Bus, Fuel, Wrench,
  HeartPulse, Pill, GraduationCap, BookOpen, Gamepad2, Film, Music, Plane, Shirt, Gift,
  Wifi, Zap, Droplet, Phone, Dumbbell, Baby, PawPrint, Briefcase, PiggyBank, Wallet,
  Scissors, Receipt,
  Pizza, Beer, Wine, Cookie, IceCream, Apple, Sandwich, Soup, Popcorn, Bike, Train, Ship, Truck, Package, Bed, Sofa, Lamp, Hammer, Paintbrush, Stethoscope, Syringe, Smile, Glasses, Laptop, Smartphone, Tv, Headphones, Camera, Ticket, PartyPopper, Trophy, TreePalm, Mountain, Tent, Umbrella, CreditCard, Banknote, Coins, TrendingUp, Percent, Building2, Newspaper, Mail, Heart, Star, Flower2, Leaf, Sun, Flame, Cat, Dog, Shield, Key, HandHeart,
} from 'lucide-react';

// As chaves são as mesmas de backend/lib/icones.js. Nome em português para o rótulo de acessibilidade.
export const ICONES_CATEGORIA = [
  ['tag', Tag, 'Etiqueta'], ['utensils', Utensils, 'Refeição'], ['coffee', Coffee, 'Café'],
  ['shopping-cart', ShoppingCart, 'Mercado'], ['shopping-bag', ShoppingBag, 'Compras'], ['home', Home, 'Casa'],
  ['car', Car, 'Carro'], ['bus', Bus, 'Ônibus'], ['fuel', Fuel, 'Combustível'], ['wrench', Wrench, 'Manutenção'],
  ['heart-pulse', HeartPulse, 'Saúde'], ['pill', Pill, 'Remédio'], ['graduation-cap', GraduationCap, 'Educação'],
  ['book-open', BookOpen, 'Livros'], ['gamepad-2', Gamepad2, 'Jogos'], ['film', Film, 'Cinema'],
  ['music', Music, 'Música'], ['plane', Plane, 'Viagem'], ['shirt', Shirt, 'Roupas'], ['gift', Gift, 'Presente'],
  ['wifi', Wifi, 'Internet'], ['zap', Zap, 'Energia'], ['droplet', Droplet, 'Água'], ['phone', Phone, 'Telefone'],
  ['dumbbell', Dumbbell, 'Academia'], ['baby', Baby, 'Filhos'], ['paw-print', PawPrint, 'Pets'],
  ['briefcase', Briefcase, 'Trabalho'], ['piggy-bank', PiggyBank, 'Poupança'], ['wallet', Wallet, 'Carteira'],
  ['scissors', Scissors, 'Beleza'], ['receipt', Receipt, 'Contas'],
  ['pizza', Pizza, 'Pizza'], ['beer', Beer, 'Bar'], ['wine', Wine, 'Vinho'], ['cookie', Cookie, 'Lanche'], ['ice-cream', IceCream, 'Sorvete'], ['apple', Apple, 'Frutas'], ['sandwich', Sandwich, 'Sanduíche'], ['soup', Soup, 'Refeição quente'], ['popcorn', Popcorn, 'Pipoca'], ['bike', Bike, 'Bicicleta'], ['train', Train, 'Trem'], ['ship', Ship, 'Barco'], ['truck', Truck, 'Frete'], ['package', Package, 'Encomenda'], ['bed', Bed, 'Cama'], ['sofa', Sofa, 'Móveis'], ['lamp', Lamp, 'Decoração'], ['hammer', Hammer, 'Obras'], ['paintbrush', Paintbrush, 'Pintura'], ['stethoscope', Stethoscope, 'Médico'], ['syringe', Syringe, 'Vacina'], ['smile', Smile, 'Dentista'], ['glasses', Glasses, 'Óculos'], ['laptop', Laptop, 'Notebook'], ['smartphone', Smartphone, 'Celular'], ['tv', Tv, 'Streaming'], ['headphones', Headphones, 'Fones'], ['camera', Camera, 'Fotos'], ['ticket', Ticket, 'Ingresso'], ['party-popper', PartyPopper, 'Festa'], ['trophy', Trophy, 'Prêmio'], ['tree-palm', TreePalm, 'Férias'], ['mountain', Mountain, 'Passeio'], ['tent', Tent, 'Camping'], ['umbrella', Umbrella, 'Seguro'], ['credit-card', CreditCard, 'Cartão'], ['banknote', Banknote, 'Dinheiro'], ['coins', Coins, 'Moedas'], ['trending-up', TrendingUp, 'Investimentos'], ['percent', Percent, 'Juros'], ['building-2', Building2, 'Aluguel'], ['newspaper', Newspaper, 'Assinaturas'], ['mail', Mail, 'Correios'], ['heart', Heart, 'Doação'], ['star', Star, 'Favorito'], ['flower-2', Flower2, 'Jardim'], ['leaf', Leaf, 'Natureza'], ['sun', Sun, 'Sol'], ['flame', Flame, 'Gás'], ['cat', Cat, 'Gato'], ['dog', Dog, 'Cachorro'], ['shield', Shield, 'Proteção'], ['key', Key, 'Chaves'], ['hand-heart', HandHeart, 'Caridade'],
].map(([chave, Icone, rotulo]) => ({ chave, Icone, rotulo }));

const POR_CHAVE = Object.fromEntries(ICONES_CATEGORIA.map(i => [i.chave, i.Icone]));

export const iconeDaChave = chave => POR_CHAVE[chave] ?? Tag;
export const iconeDaCategoria = (categorias, nome) => iconeDaChave(categorias.find(c => c.nome === nome)?.icone);
