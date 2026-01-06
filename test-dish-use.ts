const API_BASE = 'http://localhost:3000';

async function testDishUseAPI() {
  const dishId = 1;
  const testQuantities = [1, 3, 5];

  console.log('=== 开始测试 /dishes/:id/use API ===\n');

  for (const quantity of testQuantities) {
    console.log(`\n--- 测试数量: ${quantity} ---`);
    
    try {
      const url = `${API_BASE}/dishes/${dishId}/use?quantity=${quantity}`;
      console.log(`请求URL: ${url}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log(`响应状态: ${response.status} ${response.statusText}`);
      
      const data = await response.json();
      console.log('响应数据:', JSON.stringify(data, null, 2));
      
      if (data.error) {
        console.log(`❌ 错误: ${data.error}`);
      } else {
        console.log(`✅ 成功`);
        if (data.dish) {
          console.log(`菜品: ${data.dish.name}`);
        }
        if (data.updatedIngredients) {
          console.log('更新后的食材库存:');
          data.updatedIngredients.forEach(ing => {
            console.log(`  - ${ing.name}: ${ing.quantity}`);
          });
        }
      }
    } catch (error) {
      console.error(`❌ 请求失败:`, error);
    }
    
    console.log('\n' + '='.repeat(50));
  }

  console.log('\n=== 测试完成 ===');
}

testDishUseAPI();
