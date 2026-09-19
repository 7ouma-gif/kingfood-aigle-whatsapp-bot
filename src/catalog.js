const opt=(name,price=0)=>({name,price});
export const restaurant={
  name:"King Food chez Hassan – Aigle", phone:"079 717 18 60",
  address:"Rue Colomb 4, 1860 Aigle",
  delivery:{fee:5,freeCities:["aigle","yvorne"],zones:[
    {minimum:22,cities:["aigle","yvorne"]},
    {minimum:35,cities:["villeneuve","noville","rennaz","roche","chessel","vouvry","vionnaz","illarsaz","ollon","bex","saint-triphon","st-triphon","saint-maurice","st-maurice","collombey","monthey"]}
  ]}
};

const tacosMeats=["Poulet","Merguez","Viande hachée","Nuggets","Cordon bleu","Tenders","Falafel et légumes"];
const tacosSauces=["Sans fromagère","Sauce maison","Fromagère","Cocktail","Algérienne","Marocaine","Samouraï","Biggy Burger","Andalouse","Tartare","Curry","Barbecue","Cheezy Easy","Blanche","Ketchup","Mayonnaise","Harissa"];
const crudites=["Salade","Tomate","Oignon","Carotte","Maïs",opt("Olives",1),opt("Cornichons",1)];
const tacoSupp=[opt("Portion de frites",4),opt("Lardons halal",2),opt("Bacon halal",2),opt("Œuf",2),opt("Cheddar",1),opt("Mozzarella",1),opt("Raclette",1),opt("Vache qui rit",1),opt("Boursin",1),opt("Fromage de chèvre",1)];
const group=(name,options,min=0,max=99)=>({name,options:options.map(x=>typeof x==="string"?opt(x):x),min,max});

export const categories=[
 {id:"tacos",name:"Tacos",products:[
  {name:"Tacos menu étudiant M",price:12,note:"Canette offerte",groups:[group("Viandes",tacosMeats,1,3),group("Sauces",tacosSauces,1,3),group("Crudités",crudites),group("Suppléments",tacoSupp)]},
  {name:"Tacos M",price:13,note:"Canette offerte",groups:[group("Viandes",tacosMeats,1,3),group("Sauces",tacosSauces,1,3),group("Crudités",crudites),group("Suppléments",tacoSupp)]},
  {name:"Tacos L",price:15.90,note:"Canette offerte",groups:[group("Viandes",tacosMeats,1,3),group("Sauces",tacosSauces,1,3),group("Crudités",crudites),group("Suppléments",tacoSupp)]},
  {name:"Tacos XL",price:19.90,note:"2 galettes, canette offerte",groups:[group("Viandes",tacosMeats,1,3),group("Sauces",tacosSauces,1,3),group("Crudités",crudites),group("Suppléments",tacoSupp)]},
  {name:"KING Tacos",price:35,note:"5 galettes, 2 canettes offertes",groups:[group("Viandes",tacosMeats,1,3),group("Sauces",tacosSauces,1,3),group("Crudités",crudites),group("Suppléments",tacoSupp)]},
  {name:"Tacos au four",price:15.90,note:"Triple fromage, canette offerte",groups:[group("Viandes",tacosMeats,1,3),group("Sauces",tacosSauces,1,3),group("Crudités",crudites),group("Suppléments",tacoSupp)]}
 ]},
 {id:"baguette",name:"Baguette farcie",products:[{name:"Baguette farcie",price:19.90,note:"2 viandes incluses, canette offerte; 3e viande +2 CHF",groups:[group("Viandes",["Poulet","Cordon bleu","Nuggets","Tenders","Merguez","Viande hachée",opt("3e viande",2)],1,3),group("Sauce",["Spéciale piquante maison","Maison non piquante"],1,1),group("Crudités",[opt("Poivrons grillés",1),opt("Oignons grillés",1),opt("Olives",1)]),group("Suppléments",[opt("Œuf",2),opt("Cheddar",2),opt("Lardons halal",2),opt("Bacon halal",2)])]}]},
 {id:"crousty",name:"Tasty Crousty",products:[
  {name:"Tasty Crousty M",price:10,note:"1 viande incluse, oignons frits inclus",groups:[group("Préparation",["Original","Composé"],1,1),group("Viande",["Tenders","Cordon bleu","Nuggets","Émincé de poulet","Falafel"],1,1),group("Sauce",["Blanche maison","Aigre-douce","Algérienne","Barbecue","Autre"],1,2),group("Oignons frits",["Avec","Sans"],1,1),group("Gratinage",[opt("Mozzarella",3),opt("Raclette",3),opt("Cheddar",3)]),group("Suppléments",[opt("Portion de frites",4),opt("Bacon",2),opt("Lardons",2),opt("Jalapeños",1),opt("Cornichons",1),opt("Viande supplémentaire",3)])]},
  {name:"Tasty Crousty L",price:15,note:"1 viande incluse, oignons frits inclus",groups:[group("Préparation",["Original","Composé"],1,1),group("Viande",["Tenders","Cordon bleu","Nuggets","Émincé de poulet","Falafel"],1,1),group("Sauce",["Blanche maison","Aigre-douce","Algérienne","Barbecue","Autre"],1,2),group("Oignons frits",["Avec","Sans"],1,1),group("Gratinage",[opt("Mozzarella",3),opt("Raclette",3),opt("Cheddar",3)]),group("Suppléments",[opt("Portion de frites",4),opt("Bacon",2),opt("Lardons",2),opt("Jalapeños",1),opt("Cornichons",1),opt("Viande supplémentaire",3)])]}
 ]},
 {id:"kapsaloon",name:"Kapsaloon",products:[{name:"Kapsaloon",price:16.90,note:"Canette offerte; 3e viande +2 CHF; 2e fromage +1 CHF",groups:[group("Viandes",["Poulet","Merguez","Viande hachée","Nuggets","Cordon bleu","Tenders","Falafel et légumes",opt("3e viande",2)],1,3),group("Fromages",["Mozzarella","Cheddar","Raclette","Vache qui rit","Fromage de chèvre"],1,2),group("Sauces",["Fromagère","Algérienne","Marocaine","Samouraï","Biggy Burger","Andalouse","Tartare","Curry","Barbecue","Cheezy Easy","Blanche","Ketchup","Mayonnaise"],1,3),group("Crudités",["Salade","Tomate","Oignon rouge","Carotte","Maïs"]),group("Suppléments",[opt("Lardons halal",2),opt("Bacon halal",2),opt("Chorizo",2),opt("Œuf",2),opt("Miel",1),opt("Olives",1)])]}]},
 {id:"grec",name:"Grec maison",products:[{name:"Grec maison",price:18.90,note:"Pain maison; contenu inclus à confirmer par le restaurant",groups:[group("Viande",["Poulet tandoori","Gigot d’agneau","Kofté","Merguez","Tenders","Cordon bleu","Végétarien"],1,1),group("Sauces",["Sauce maison","Spéciale maison piquante","Maison non piquante","Cocktail spéciale","Algérienne"],1,2),group("Crudités",["Salade","Tomate","Oignon"]),group("Suppléments",[opt("Œuf",2),opt("Cheddar",2),opt("Lardons halal",2),opt("Bacon halal",2)])]}]},
 {id:"snacks",name:"Snacks",products:[
  ...["Oignons Rings","Nuggets","Falafel","Calamars"].flatMap(name=>[{name:`${name} 6 pièces`,price:8,groups:[]},{name:`${name} 12 pièces`,price:15,groups:[]},{name:`${name} 18 pièces`,price:22,groups:[]}]),
  ...["Mozzarella Sticks","Chicken Tenders"].flatMap(name=>[{name:`${name} 6 pièces`,price:11,groups:[]},{name:`${name} 12 pièces`,price:18,groups:[]},{name:`${name} 18 pièces`,price:25,groups:[]}]),
  {name:"Petite portion de frites",price:5,groups:[]},{name:"Grande portion de frites",price:9,groups:[]}
 ]}
];
