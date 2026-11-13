const L = require('../cloudfunctions/api/lib')
const { loadCategories } = require('../cloudfunctions/api/handlers/categories')

async function seedReferenceData(db) {
  await db.runInTransaction(async () => {
    if ((await db.collection('categories').count()).total) return
    for (const { id, ...data } of await loadCategories()) {
      await db.collection('categories').doc(id).set({ data: { ...data, enabled: true, createdAt: Date.now() } })
    }
    return L.ok()
  })
}
module.exports = { seedReferenceData }
