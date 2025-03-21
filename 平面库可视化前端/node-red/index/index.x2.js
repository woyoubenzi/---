// 初始化 ECharts 实例
const warehouseChart = echarts.init(document.getElementById('warehouseChart'));

// 仓库结构
const warehouse = { rows: 12, cols: 18, grid: [] }; // 仓库行数、列数和网格数据
const vehicles = []; // 小车数据

// 初始化数据库
const database = []; // 默认空数组

// 设置走廊
function setCorridors(corridors) {
    corridors.forEach(corridor => {
        if (corridor.row !== undefined) {
            for (let j = corridor.start; j <= corridor.end; j++) {
                warehouse.grid[corridor.row][j].corridor = true;
            }
        } else if (corridor.col !== undefined) {
            for (let i = corridor.start; i <= corridor.end; i++) {
                warehouse.grid[i][corridor.col].corridor = true;
            }
        }
    });
}

// 设置开放区域
function setOpenAreas(openAreas) {
    openAreas.forEach(area => {
        if (area.row !== undefined) {
            for (let j = area.start; j <= area.end; j++) {
                warehouse.grid[area.row][j].openArea = true;
            }
        } else if (area.col !== undefined) {
            for (let i = area.start; i <= area.end; i++) {
                warehouse.grid[i][area.col].openArea = true;
            }
        }
    });
}

// 设置充电桩
function setChargingStations(stations) {
    stations.forEach(station => {
        warehouse.grid[station.row][station.col].charging = true;
    });
}

// 设置取放货位
function setPickupPoints(points) {
    points.forEach(point => {
        warehouse.grid[point.row][point.col].pickup = true;
    });
}

// 初始化仓库
function initializeWarehouse() {
    warehouse.grid = []; // 初始化仓库网格
    for (let i = 0; i < warehouse.rows; i++) {
        const row = [];
        for (let j = 0; j < warehouse.cols; j++) {
            row.push({
                status: 'empty', // 状态
                corridor: false, // 是否为走廊
                openArea: false, // 是否为开放区域
                unavailable: false, // 是否为不可用货位
                charging: false, // 是否为充电桩
                pickup: false, // 是否为取放货位
                slotNumber: null, // 默认没有编号
                productName: null, // 默认没有产品名称
                palletNumber: null // 默认没有托盘号
            });
        }
        warehouse.grid.push(row); // 将行添加到仓库网格
    }

    // 设置走廊和开放区域
    setCorridors([{ col: 4, start: 0, end: 11 }, { col: 11, start: 0, end: 11 },{row: 6, start: 5, end: 10}]);
    setOpenAreas([
        { row: 3, start: 8, end: 8 },
        { row: 8, start: 8, end: 8 },
        { row: 9, start: 6, end: 10 },
        { row: 10, start: 5, end: 10 },
        { row: 11, start: 6, end: 10 },
        { row: 8, start: 17, end: 17 },
        { row: 9, start: 13, end: 17 },
        { row: 10, start: 12, end: 17 },
        { row: 11, start: 13, end: 17 },
    ]);

    // 设置充电桩和取放货位
    setChargingStations([{ row: 11, col: 6 }]);
    setPickupPoints([
        { row: 10, col: 5 },
        { row: 10, col: 12 },
    ]);
}

// 为可用货位分配编号
function assignSlotNumbersToAvailableSlots() {
    let counter = 1; // 编号计数器
    for (let i = 0; i < warehouse.rows; i++) {
        for (let j = 0; j < warehouse.cols; j++) {
            const slot = warehouse.grid[i][j];
            if (slot.status === 'empty' || slot.status === 'occupied' || slot.status === 'unavailable') {
                slot.slotNumber = `1-${i + 1}-${j + 1}`; // 生成编号
                counter++;
            }
        }
    }
    console.log(`共分配了 ${counter} 个货位编号`);
}

// 批量添加小车数据的方法
function addVehicles(vehicleData) {
    vehicleData.forEach(vehicle => {
        let color;
        if (vehicle.battery > 75) {
            color = '#00FF00'; // 绿色
        } else if (vehicle.battery > 20) {
            color = '#FFA500'; // 橙色
        } else {
            color = '#FF0000'; // 红色
        }
        let labelColor = '#fff'; // 默认字体颜色为白色
        if (vehicle.task === '无') {
            labelColor = '#000'; // 修改字体颜色为黑色
        }
        vehicles.push({ ...vehicle, color, labelColor });
    });
}

// // 小车数据
// function refreshVehicles() {
//     vehicles.length = 0; // 清空小车数据
//     addVehicles([
//         { id: 1, row: 3, col: 2, battery: 85, task: '无', start: '无', end: '1-1-11' },
//         { id: 2, row: 6, col: 5, battery: 50, task: '零食 220005', start: 'C2', end: '1-1-10' }
//     ]);
// }

// 根据数据库更新货位状态
function updateSlotStatusFromDatabase(database) {
    // 遍历仓库网格
    for (let i = 0; i < warehouse.rows; i++) {
        for (let j = 0; j < warehouse.cols; j++) {
            const slot = warehouse.grid[i][j];
            // 重置所有动态状态
            slot.status = 'empty'; // 默认设为空库位
            slot.productName = null;
            slot.palletNumber = null;
            slot.unavailable = false; // 重置为可用
        }
    }

    // 根据 database 动态更新
    database.forEach(entry => {
        const [layer, row, col] = entry.slotNumber.split('-').map(Number);
        const slot = warehouse.grid[row - 1][col - 1];
        if (slot) {
            // 更新状态
            slot.status = entry.status;
            slot.productName = entry.productName || null;
            slot.palletNumber = entry.palletNumber || null;
            if (entry.status === 'unavailable') {
                slot.unavailable = true; // 锁定状态
            }
        }
    });
}

// 动态获取数据 
async function refreshData() {
    try {
        // 从 Node-RED 获取动态数据
        const response = await fetch('/api/warehouse/x2');
        const data = await response.json();

        // 覆盖库位数据
        database.length = 0; // 清空当前数据库
        database.push(...data.slots); // 使用后端返回的数据填充

        // 更新小车数据
        vehicles.length = 0;
        addVehicles(data.vehicles);

        // 更新仓库状态并渲染
        updateSlotStatusFromDatabase(database);
        renderWarehouse();
    } catch (error) {
        console.error('数据刷新失败:', error);
    }
}




// 渲染 ECharts 仓库
function renderWarehouse() {
    const gridData = []; // 网格数据
    const carData = []; // 小车数据
    const flagData = []; // 新增数组用于存储小旗数据

    for (let i = 0; i < warehouse.rows; i++) {
        for (let j = 0; j < warehouse.cols; j++) {
            const slot = warehouse.grid[i][j];
            let color = 1; // 默认绿色（空货位）

            if (slot.status === 'occupied') color = 2;
            if (slot.corridor) color = 3;
            if (slot.openArea) color = 4;
            if (slot.unavailable) color = 5; // 确保锁定货位颜色设置为灰色
            if (slot.charging) color = 6;
            if (slot.pickup) color = 7;

            gridData.push([j, warehouse.rows - 1 - i, color]);
        }
    }

    vehicles.forEach(v => {
        carData.push({
            value: [v.col, warehouse.rows - 1 - v.row],
            itemStyle: {
                color: v.color, // 确保小车颜色正确设置
                borderColor: '#fff',
                borderWidth: 1
            },
            label: {
                show: true,
                formatter: `${v.id}`,
                position: 'inside',
                color: v.labelColor, // 使用动态字体颜色
                fontSize: 16,
                fontWeight: 'bold'
            },
            tooltip: {
                formatter: `🚗 任务: ${v.task}<br>🔋 电量: ${v.battery}%<br>起点: ${v.start}<br>终点: ${v.end}`
            }
        });

        // 如果小车有任务终点，插入小旗
        if (v.end && v.task !== '无') { // 检查小车是否有任务终点且任务不为“无”
            const [layer, row, col] = v.end.split('-').map(Number); // 将终点位置的库位编号拆分为层、行、列，并转换为数字
            flagData.push({
                value: [col - 1, warehouse.rows - row], // 设置小旗的位置，列减1，行使用仓库总行数减去当前行数
                itemStyle: {
                    color: '#FF0080' // 小旗颜色为红色
                },
                label: {
                    show: true, // 显示标签
                    formatter: `🚩${v.id}`, // 标签内容为小旗图标和小车编号
                    position: 'top', // 标签位置在小旗顶部
                    color: '#FF0000', // 小旗标签颜色为红色
                    fontSize: 12, // 标签字体大小
                    fontWeight: 'bold' // 标签字体加粗
                }
            });
        }
    });

    const option = {
        tooltip: {
            trigger: 'item', // 设置触发类型为 'item'，即鼠标悬浮在图表元素上触发提示框
            formatter: function (params) {
                // 解构 params.value，假设其格式为 [列索引, 行索引, 类型]
                const [col, row, type] = params.value;
                // 根据行列索引从仓库网格数据中获取对应的槽位信息
                const slot = warehouse.grid[warehouse.rows - 1 - row][col];
    
                let tooltipText = ''; // 初始化提示框文本
    
                // 根据类型显示对应的描述
                switch (type) {
                    case 1: // 空库位
                        tooltipText = '类型: 空库位';
                        break;
                    case 2: // 有货位
                        tooltipText = '类型: 有货位';
                        break;
                    case 3: // 走廊
                        tooltipText = '类型: 走廊';
                        break;
                    case 4: // 开放区域
                        tooltipText = '类型: 开放区域';
                        break;
                    case 5: // 锁定库位
                        tooltipText = '类型: 锁定库位';
                        break;
                    case 6: // 充电桩
                        tooltipText = '类型: 充电桩';
                        break;
                    case 7: // 取放货位
                        tooltipText = '类型: 取放货位';
                        break;
                }
    
                // 如果是空库位、锁定库位或有货位，显示详细信息
                if ((type === 1 || type === 2 || type === 5) && slot.slotNumber) {
                    tooltipText += `<br>编号: ${slot.slotNumber}`; // 显示槽位编号
                    tooltipText += `<br>产品: ${slot.productName || '无'}`; // 显示产品名称，如果没有则为 '无'
                    tooltipText += `<br>托盘号: ${slot.palletNumber || '无'}`; // 显示托盘号，如果没有则为 '无'
                }
    
                return tooltipText; // 返回生成的提示框文本
            }
        },
        xAxis: { 
            type: 'category', // 设置 x 轴为分类轴
            data: [...Array(warehouse.cols).keys()] // 使用仓库列数生成 x 轴数据（0 到 cols-1）
        },
        yAxis: { 
            type: 'category', // 设置 y 轴为分类轴
            data: [...Array(warehouse.rows).keys()].reverse() // 使用仓库行数生成 y 轴数据（倒序，行号从大到小）
        },
        grid: { 
            left: '5%', // 图表距离容器左侧的距离
            right: '5%', // 图表距离容器右侧的距离
            top: '10%', // 图表距离容器顶部的距离
            bottom: '10%' // 图表距离容器底部的距离
        },
        visualMap: {
            min: 1, // 视觉映射的最小值
            max: 7, // 视觉映射的最大值
            show: false, // 不显示视觉映射组件
            inRange: { 
                // 定义不同类型对应的颜色
                color: ['#00FF00', '#FFD700', '#0000FF', '#FFFFFF', '#808080', '#FF0000', '#00FFFF'] 
            }
        },
        series: [
            {
                name: '仓库状态', // 系列名称
                type: 'heatmap', // 设置为热力图类型
                data: gridData, // 热力图数据，表示仓库网格的状态
                itemStyle: { 
                    borderColor: '#aaa', // 网格边框颜色
                    borderWidth: 1 // 网格边框宽度
                }
            },
            {
                name: '小车', // 系列名称
                type: 'scatter', // 设置为散点图类型
                symbolSize: 25, // 散点的大小
                data: carData // 散点图数据，表示小车的位置
            },
            {
                name: '小旗', // 新增系列名称
                type: 'scatter', // 设置为散点图类型
                symbol: 'pin', // 使用小旗图标
                symbolSize: 30, // 小旗的大小
                data: flagData // 小旗数据，表示任务终点的位置
            }
        ]
    };

    warehouseChart.setOption(option); // 设置 ECharts 配置项
}

// 事件监听
document.getElementById('refreshBtn').addEventListener('click', refreshData); // 监听刷新按钮点击事件

// 初始化与刷新
initializeWarehouse(); // 初始化仓库
assignSlotNumbersToAvailableSlots(); // 为可用货位分配编号
refreshData(); // 刷新数据

//setInterval(refreshData, 1000); // 动态刷新数据