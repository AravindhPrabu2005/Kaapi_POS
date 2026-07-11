const { db, pool } = require('./db');
const { products } = require('./src/db/schema');
const { eq } = require('drizzle-orm');

const imageMap = {
  "Fried Chicken": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/65feb5b5d2cdc36c74171abc592c376ca9c1ec53.jpg",
  "Fried chicken": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/65feb5b5d2cdc36c74171abc592c376ca9c1ec53.jpg",
  "Espresso": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/3f6e1420f14fb4a63eeda8bba45754144497d820.jpg",
  "Americano": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/39722d60347f0385f32ab989553e2bcba44a78d4.jpg",
  "Latte": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/883acd5985411cbfaa369fb2214e0d372568fef7.jpg",
  "Cappuccino": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/fb6d797931c432ff56afd6e4b666d6db308a45fb.jpg",
  "Mocha": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/f80c377f49462c61de0f0ff3767be2b6678c9d48.jpg",
  "Cold Brew": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/d6162417d051b16b052ced6f27e8d469f00f404c.jpg",
  "Flat White": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/7e317ba2dddea795420e4fe01201ecdb7645a28f.jpg",
  "Macchiato": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Macchiato_%287199366530%29.jpg/500px-Macchiato_%287199366530%29.jpg",
  "Masala Chai": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/76614a4d3383d0880f6b5f980a6692a35ce2f815.jpg",
  "Green Tea": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/346f9d393ec184a1759321f7d95b5438dc2f3eec.jpg",
  "Earl Grey": "https://upload.wikimedia.org/wikipedia/commons/d/d0/Frisch_aufgebr%C3%BChter_EarlGrey_Tee.jpg",
  "Lemon Tea": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/a948aef957b45785565ef40f6b1d39a7b377c1de.jpg",
  "Iced Tea": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/d1739ed366cf301ff380733dcc9dfb1b3559f88f.jpg",
  "Fresh Lime Soda": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/3a0439d4a68d1b5f79a1d835044fbfc90237b339.jpg",
  "Orange Juice": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/1f5364bb61fc96430370259ec4a0590af7abc79c.jpg",
  "Watermelon Juice": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/f37c3611229c584d4865200b5dfc8c5a45ab87bd.jpg",
  "Smoothie": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/2c1f23d5aa22540737559f7d026e2ba956b818e3.jpg",
  "Milkshake": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/707f8d743f9aca96b81a2da359a28947bd7d159e.jpg",
  "Croissant": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/4de48b5174daff25c14a8fc1050247f4cc80c149.jpg",
  "Blueberry Muffin": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/6f0613eed0b73d7b828363b64c849d6e59c55de8.jpg",
  "Chocolate Danish": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/1ea7e76b9c81e2125e9909afdb3a231681995abf.jpg",
  "Cinnamon Roll": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/402ae8724d122e9e95c29a179ffbb70a6b508141.jpg",
  "Club Sandwich": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/cb062ed6740804af101da4839bdbdd2f97728ae6.jpg",
  "Grilled Cheese": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/5a006a6b127dd3ec6f8b248f83447d7aaafc4644.jpg",
  "Chicken Wrap": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/a404d7a7eb005fbe80c57998f89419448edac1c2.jpg",
  "Veggie Panini": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/3635d71d2c697caa1b4baddb5d911e106bc0d636.jpg",
  "Tiramisu": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/d12e85cd78af8374d374c1576ad9a6e6b0fbbbd5.jpg",
  "Cheesecake": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/f41519cfbbc02bcea3b3fcabdbb1bd4ddfadda24.jpg",
  "Brownie": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/ab1b7bca278dccaed59606c41fbc30b3b9c9d1a9.jpg",
  "Ice Cream Sundae": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/8377548fe7c01bac700f258a9c61a091538dd463.jpg",
  "French Fries": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/fab338400e1dbc94aaefe585cd73b705e13e8b07.jpg",
  "Nachos": "https://upload.wikimedia.org/wikipedia/commons/8/87/Nachos-cheese.jpg",
  "Onion Rings": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/2a6d2aa8178cde5692ea67012dabd4ee8ba19230.jpg",
  "Garlic Bread": "https://pplx-res.cloudinary.com/image/upload/pplx_search_images/66cfdb657a3a6644247b15694a77eecd4607762b.jpg",
};

(async () => {
  try {
    const all = await db.select().from(products);
    let updated = 0;
    for (const p of all) {
      const url = imageMap[p.name];
      if (url) {
        await db.update(products).set({ imageUrl: url }).where(eq(products.id, p.id));
        console.log(`✓ ${p.name}`);
        updated++;
      } else {
        console.log(`✗ ${p.name} — no image URL mapped`);
      }
    }
    console.log(`\nDone. Updated ${updated} / ${all.length} products.`);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
})();
