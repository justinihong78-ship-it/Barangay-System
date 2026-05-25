const http = require('http');

function getResidents() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3000/api/residents', res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({status: res.statusCode, body}));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function deleteResident(id) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/residents/${id}`,
      method: 'DELETE'
    };
    const req = http.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({status: res.statusCode, body}));
    });
    req.on('error', reject);
    req.end();
  });
}

(async function() {
  try {
    const list = await getResidents();
    console.log('GET STATUS', list.status);
    const residents = JSON.parse(list.body);
    console.log('RESIDENT COUNT', Array.isArray(residents) ? residents.length : 'invalid');
    if (!Array.isArray(residents) || residents.length === 0) return;
    console.log('First resident:', {id: residents[0].id, name: residents[0].full_name, deleted_at: residents[0].deleted_at});
    const result = await deleteResident(residents[0].id);
    console.log('DELETE STATUS', result.status);
    console.log(result.body);
  } catch (err) {
    console.error('ERROR', err.message);
    console.error(err);
  }
})();