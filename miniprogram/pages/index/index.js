// index.js
import '../../utils/extendApi'
import WxRequest from 'mina-request'


// 对 WxRequest 进行实例化
const instance = new WxRequest({
    baseURL: 'https://devapi.qweather.com', // 使用时请换成真实接口
    timeout: 1000, // 超时时长
    isLoading: false // 是否使用默认的 loading 效果
})
const instanceGeoapi = new WxRequest({
    baseURL: 'https://geoapi.qweather.com', // 使用时请换成真实接口
    timeout: 1000, // 超时时长
    isLoading: false // 是否使用默认的 loading 效果
})

Page({
    /**
     * 页面的初始数据
     */
    data: {
        // 实时天气
        latitude: '',  // 纬度
        longitude: '', // 经度
        shishitianqi: '', // 实时天气

        // 空气质量
        zhiliang: '', // 空气质量

        //城市
        cityData: '',

        //每日天气预报-3天
        daily3Weather: [], // 3 天的天气数据

        // 24小时天气数据
        hourlyWeather: [], // 24小时天气数据

        // 7 天天气数据
        daily7Weather: [], // 7 天天气数据

        // 生活指数
        lifeIndices: '',

        // 从address页面传递过来的数据。返回整个对象
        selectedCity: {},
        
        // 新增数据项
        isOffline: false, // 是否处于离线状态
        lastUpdateTime: '', // 上次数据更新时间
        
        // 添加折线图绘制标志位
        chartDrawn: false, // 标记折线图是否已经绘制
    },
    // 地理定位
    // 地理定位
    async requestLocation() {
        try {
            // 先尝试检查网络状态
            const networkType = await this.checkNetworkStatus();
            
            // 如果没有网络，直接尝试加载缓存数据
            if (networkType === 'none') {
                if (this.loadCachedWeatherData()) {
                    wx.showToast({
                        title: '无网络，使用缓存数据',
                        icon: 'none',
                        duration: 2000
                    });
                    return;
                }
            }
            
            // 检查是否已有有效的纬度和经度
            let latitude = this.data.latitude;
            let longitude = this.data.longitude;

            // 如果纬度或经度为空，则需要获取地理位置
            if (latitude === '' || longitude === '') {
                try {
                    // 获取当前的地理位置
                    const location = await wx.getLocation();
                    // 获取新的纬度和经度
                    latitude = location.latitude.toFixed(2);
                    longitude = location.longitude.toFixed(2);
                    console.log("获取新的经度：" + longitude + "，纬度：" + latitude);
                } catch (error) {
                    console.error("获取地理位置失败：", error);
                    wx.showToast({
                        title: '获取位置失败，请检查定位权限',
                        icon: 'none',
                        duration: 2000
                    });
                    return;
                }
            } else {
                console.log("使用存储的经纬度：" + longitude + "，纬度：" + latitude);
            }

            // 如果请求新位置的天气数据，需要重置图表状态
            this.resetChartState();

            // 使用获取的或存储的经纬度来进行API请求
            // GeoAPI城市搜索
            const citySearch = await instanceGeoapi.get('/v2/city/lookup', {
                location: longitude + "," + latitude,
                key: "2d57f1cc456d421c8bbdd925db34555a"
            });

            // 获取实时天气
            const weatherNow = await instance.get('/v7/weather/now', {
                location: longitude + "," + latitude,
                key: "2d57f1cc456d421c8bbdd925db34555a"
            });

            // 获取空气质量
            const airQuality = await instance.get('/v7/air/now', {
                location: longitude + "," + latitude,
                key: "2d57f1cc456d421c8bbdd925db34555a"
            });

            // 获取3天的天气预报
            const weather3Day = await instance.get('/v7/weather/3d', {
                location: longitude + "," + latitude,
                key: "2d57f1cc456d421c8bbdd925db34555a"
            });
            const daily3Weather = weather3Day.data.daily.map((day, index) => ({
                dayLabel: ["今天", "明天", "后天"][index],  // 今天、明天、后天
                tempMax: day.tempMax,
                tempMin: day.tempMin,
                iconDay: day.iconDay,
                textDay: day.textDay
            }));

            // 获取逐小时天气预报
            const hour24 = await instance.get('/v7/weather/24h', {
                location: longitude + "," + latitude,
                key: "2d57f1cc456d421c8bbdd925db34555a"
            });
            const hourlyWeather = hour24.data.hourly.map(hour => ({
                time: hour.fxTime.slice(11, 16),  // 提取 "15:00" 格式时间
                temp: hour.temp,  // 温度
                icon: hour.icon  // 图标编号
            }));

            // 获取7天的天气预报
            const weather7Day = await instance.get('/v7/weather/7d', {
                location: longitude + "," + latitude,
                key: "2d57f1cc456d421c8bbdd925db34555a"
            });

            const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
            const daily7Weather = weather7Day.data.daily.map((day, index) => ({
                date: day.fxDate.slice(5),  // 提取 "MM-DD" 格式日期
                weekday: weekdays[new Date(day.fxDate).getDay()],  // 获取星期几
                tempMax: day.tempMax,  // 最高温度
                tempMin: day.tempMin,  // 最低温度
                iconDay: day.iconDay,  // 白天天气图标
                iconNight: day.iconNight,  // 晚上天气图标
                textDay: day.textDay,  // 白天天气描述
                textNight: day.textNight,  // 夜晚天气描述
                windDirDay: day.windDirDay,  // 白天风向
                windScaleDay: day.windScaleDay  // 白天风力等级
            }));

            // 获取生活指数
            const lifeIndex = await instance.get('/v7/indices/1d', {
                location: longitude + "," + latitude,
                key: "2d57f1cc456d421c8bbdd925db34555a",
                type: '1,2,3,4,5,6,8,9,12,13,14,16'
            });
            
            // 获取当前时间作为更新时间
            const now = new Date();
            const lastUpdateTime = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            
            // 更新数据
            const weatherData = {
                cityData: citySearch.data.location[0],
                latitude: latitude,
                longitude: longitude,
                shishitianqi: weatherNow.data.now,
                zhiliang: airQuality.data.now.category,
                daily3Weather: daily3Weather,
                hourlyWeather: hourlyWeather,
                daily7Weather: daily7Weather,
                lifeIndices: lifeIndex.data.daily,
                lastUpdateTime: lastUpdateTime,
                isOffline: false
            };
            
            this.setData(weatherData);
            
            // 缓存天气数据到本地
            this.cacheWeatherData(weatherData);
            
            // 延迟绘制折线图，让页面先完成渲染
            // 确保图表尚未绘制时才执行绘制
            if (!this.data.chartDrawn) {
                setTimeout(() => {
                    this.zhexiantu();  // 等待绘制图表
                }, 300);
            }
            
            // 返回成功的Promise
            return Promise.resolve();
        } catch (error) {
            console.error("请求失败：", error);
            
            // 请求失败时，尝试读取缓存数据
            const success = this.loadCachedWeatherData();
            if (success) {
                wx.showToast({
                    title: '网络异常，正在使用缓存数据',
                    icon: 'none',
                    duration: 2000
                });
            } else {
                wx.showToast({
                    title: '网络异常，无缓存数据',
                    icon: 'none',
                    duration: 2000
                });
            }
            
            // 返回失败的Promise
            return Promise.reject(error);
        }
    },
    
    // 新增方法：检查网络状态
    async checkNetworkStatus() {
        try {
            const res = await wx.getNetworkType();
            return res.networkType;
        } catch (error) {
            console.error("获取网络状态失败：", error);
            return 'unknown';
        }
    },
    
    // 新增方法：缓存天气数据
    cacheWeatherData(weatherData) {
        try {
            wx.setStorageSync('weatherData', weatherData);
            console.log('天气数据缓存成功');
        } catch (error) {
            console.error('缓存天气数据失败：', error);
        }
    },
    
    // 新增方法：加载缓存的天气数据
    loadCachedWeatherData() {
        try {
            const cachedData = wx.getStorageSync('weatherData');
            if (cachedData) {
                // 重置图表状态，以便重新绘制
                this.resetChartState();
                
                // 更新数据 - 保留原始的离线状态标志，除非明确指定要设置为离线模式
                // 只有在当前网络状态为离线时才将缓存数据标记为离线模式
                this.setData(cachedData);
                
                // 延迟绘制图表，避免与页面渲染冲突
                // 只有在图表尚未绘制时才执行绘制
                if (!this.data.chartDrawn) {
                    setTimeout(() => {
                        this.zhexiantu();
                    }, 300);
                }
                
                console.log('成功加载缓存的天气数据');
                return true;
            }
            return false;
        } catch (error) {
            console.error('加载缓存天气数据失败：', error);
            return false;
        }
    },

    // 点击进入选择位置
    clickAddress() {
        // 保留当前页面，跳转到应用内的某个页面，但是不能跳到tabbar 页面。
        wx.navigateTo({
            url: '/pages/address/address',
        })
    },
    // 折线图
    // 修改 zhexiantu 方法，使其动态绘制 7 天的气温折线图
    zhexiantu() {
        // 如果图表已经绘制过，则不再重复绘制
        if (this.data.chartDrawn) {
            console.log('折线图已经绘制过，跳过重复绘制');
            return Promise.resolve();
        }

        // 使用Promise包装绘图过程，以便可以等待绘制完成
        return new Promise((resolve) => {
            // 使用setTimeout延迟绘制，让页面先完全渲染
            setTimeout(() => {
                const ctx = wx.createCanvasContext('weatherCanvas');  // 获取canvas绘图上下文
                const { daily7Weather } = this.data; // 读取数据
                if (!daily7Weather.length) {
                    resolve();
                    return;
                }

                // 获取最高温度和最低温度
                const data1 = daily7Weather.map(day => parseInt(day.tempMax));
                const data2 = daily7Weather.map(day => parseInt(day.tempMin));
                const maxTemp = Math.max(...data1);  // 计算最大温度
                const minTemp = Math.min(...data2);  // 计算最小温度

                // 调整温度范围，使高温和低温曲线更靠近
                const tempRangeExpansion = 0.4; // 温度范围调整系数（值越小，两条线越靠近）
                const tempDiff = maxTemp - minTemp; // 原始温度差
                const adjustedMaxTemp = maxTemp + tempDiff * (1 - tempRangeExpansion) / 2; // 向上扩展
                const adjustedMinTemp = minTemp - tempDiff * (1 - tempRangeExpansion) / 2; // 向下扩展

                // 使用wx.createSelectorQuery()获取canvas的宽度和容器宽度
                wx.createSelectorQuery()
                    .select('.weatherCanvas-container')
                    .boundingClientRect(containerRect => {
                        const containerWidth = containerRect.width;
                        
                        wx.createSelectorQuery()
                            .select('.yubao7day_container')
                            .boundingClientRect(itemsRect => {
                                const chartWidth = containerWidth || 350;  // 获取容器宽度，默认350
                                const chartHeight = 120; // 图表高度
                                const margin = 25;       // 边距
                                
                                // 计算每个点的间隔，确保对齐
                                const items = daily7Weather.length;
                                // 确保分段数量与上下的元素对齐
                                const stepX = (chartWidth - 2 * margin) / (items - 1);
                                
                                // 添加动画参数 - 减少动画帧数，使动画更快完成
                                let animationProgress = 0; // 动画进度，从0到1
                                const animationDuration = 15; // 减少帧数（原为30）
                                let currentFrame = 0;
                                
                                // 预先计算点的坐标，避免重复计算
                                const points1 = [];
                                const points2 = [];
                                
                                for (let i = 0; i < data1.length; i++) {
                                    const x = margin + (i * stepX);
                                    
                                    // 计算原始y坐标 - 高温
                                    const originalY1 = chartHeight - margin - ((data1[i] - adjustedMinTemp) / (adjustedMaxTemp - adjustedMinTemp)) * (chartHeight - 2 * margin);
                                    points1.push({ 
                                        x, 
                                        originalY: originalY1, 
                                        temp: data1[i],
                                        color: getColorByTemperature(data1[i])
                                    });
                                    
                                    // 计算原始y坐标 - 低温
                                    const originalY2 = chartHeight - margin - ((data2[i] - adjustedMinTemp) / (adjustedMaxTemp - adjustedMinTemp)) * (chartHeight - 2 * margin);
                                    points2.push({ 
                                        x, 
                                        originalY: originalY2, 
                                        temp: data2[i],
                                        color: getColorByTemperature(data2[i])
                                    });
                                }
                                
                                // 绘制曲线方法（包含动画）
                                const drawAnimatedCurve = () => {
                                    // 清空画布
                                    ctx.clearRect(0, 0, chartWidth, chartHeight);
                                    
                                    // 计算当前动画进度 (0到1之间)
                                    animationProgress = currentFrame / animationDuration;
                                    
                                    // 绘制曲线方法 - 使用贝塞尔曲线代替折线
                                    const drawCurve = (points, color) => {
                                        ctx.beginPath();
                                        
                                        // 如果点数不足，直接返回
                                        if (points.length < 2) return;
                                        
                                        // 计算动画中的当前点坐标
                                        const animatedPoints = points.map(point => {
                                            const animatedY = chartHeight - margin - ((chartHeight - margin - point.originalY) * animationProgress);
                                            return { 
                                                x: point.x, 
                                                y: animatedY, 
                                                temp: point.temp,
                                                color: point.color
                                            };
                                        });
                                        
                                        // 起始点
                                        const startX = animatedPoints[0].x;
                                        const startY = animatedPoints[0].y;
                                        ctx.moveTo(startX, startY);
                                        
                                        // 使用贝塞尔曲线连接点，创建平滑的曲线效果
                                        for (let i = 0; i < animatedPoints.length - 1; i++) {
                                            // 当前点和下一个点
                                            const p0 = animatedPoints[i];
                                            const p1 = animatedPoints[i + 1];
                                            
                                            // 计算控制点 - 使用简单的方式计算控制点来创建平滑曲线
                                            const cp1x = p0.x + (p1.x - p0.x) / 3;
                                            const cp1y = p0.y;
                                            const cp2x = p0.x + 2 * (p1.x - p0.x) / 3;
                                            const cp2y = p1.y;
                                            
                                            // 绘制贝塞尔曲线
                                            ctx.bezierCurveTo(
                                                cp1x, cp1y,
                                                cp2x, cp2y,
                                                p1.x, p1.y
                                            );
                                        }
                                        
                                        // 创建渐变色
                                        const gradient = ctx.createLinearGradient(0, 0, chartWidth, 0);
                                        for (let i = 0; i < points.length; i++) {
                                            const position = i / (points.length - 1);
                                            gradient.addColorStop(position, points[i].color);
                                        }
                                        
                                        ctx.setStrokeStyle(gradient);
                                        ctx.setLineWidth(2.5);
                                        ctx.setLineCap('round');
                                        ctx.setLineJoin('round');
                                        ctx.stroke();
                                        
                                        return animatedPoints;
                                    };

                                    // 绘制最高温度曲线和最低温度曲线
                                    const highPoints = drawCurve(points1);
                                    const lowPoints = drawCurve(points2);
                                    
                                    // 绘制点和文本（简化显示逻辑）
                                    if (animationProgress > 0.5) { // 当曲线达到50%高度时开始显示点和文本（原为70%）
                                        const opacity = Math.min(1, (animationProgress - 0.5) / 0.5); // 0-1之间的不透明度
                                        
                                        if (highPoints && lowPoints) {
                                            for (let i = 0; i < highPoints.length; i++) {
                                                const high = highPoints[i];
                                                const low = lowPoints[i];
                                                
                                                // 最高温点
                                                ctx.beginPath();
                                                ctx.arc(high.x, high.y, 4, 0, 2 * Math.PI);
                                                ctx.setFillStyle(`rgba(${hexToRgb(high.color)}, ${opacity})`);
                                                ctx.fill();
                                                ctx.setFillStyle(`rgba(${hexToRgb(high.color)}, ${opacity})`);
                                                ctx.setFontSize(12);
                                                ctx.fillText(high.temp + '°', high.x - 10, high.y - 10);
                                                
                                                // 最低温点
                                                ctx.beginPath();
                                                ctx.arc(low.x, low.y, 4, 0, 2 * Math.PI);
                                                ctx.setFillStyle(`rgba(${hexToRgb(low.color)}, ${opacity})`);
                                                ctx.fill();
                                                ctx.setFillStyle(`rgba(${hexToRgb(low.color)}, ${opacity})`);
                                                ctx.setFontSize(12);
                                                ctx.fillText(low.temp + '°', low.x - 10, low.y + 15);
                                            }
                                        }
                                    }
                                    
                                    // 绘制并更新画布 - 优化draw调用
                                    ctx.draw();
                                    
                                    // 继续动画
                                    if (currentFrame < animationDuration) {
                                        currentFrame++;
                                        // 使用setTimeout代替requestAnimationFrame，更可控
                                        setTimeout(drawAnimatedCurve, 17);
                                    } else {
                                        // 动画完成，标记图表已绘制
                                        this.setData({ chartDrawn: true });
                                        resolve(); // 完成Promise
                                    }
                                };
                                
                                // 辅助函数：将十六进制颜色转换为RGB格式
                                const hexToRgb = (hex) => {
                                    // 移除#符号如果存在
                                    hex = hex.replace('#', '');
                                    
                                    // 解析RGB值
                                    const r = parseInt(hex.substring(0, 2), 16);
                                    const g = parseInt(hex.substring(2, 4), 16);
                                    const b = parseInt(hex.substring(4, 6), 16);
                                    
                                    // 返回RGB格式字符串
                                    return `${r}, ${g}, ${b}`;
                                };
                                
                                // 根据温度获取对应颜色
                                function getColorByTemperature(temp) {
                                    // 高温颜色（偏热、暖色调）
                                    if (temp > 35) return '#FF0000'; // 极高温（> 35°C）：红色
                                    if (temp >= 30) return '#FF4500'; // 高温（30°C ~ 35°C）：橙红色
                                    if (temp >= 25) return '#FFA500'; // 温暖（25°C ~ 30°C）：橙色
                                    
                                    // 中性温度
                                    if (temp >= 20) return '#ADFF2F'; // 适中（20°C ~ 25°C）：黄绿色
                                    if (temp >= 15) return '#7CFC00'; // 略凉（15°C ~ 20°C）：草绿色
                                    
                                    // 低温颜色（偏冷、冷色调）
                                    if (temp >= 0) return '#00BFFF'; // 凉爽（0°C ~ 15°C）：天蓝色
                                    if (temp >= -10) return '#1E90FF'; // 低温（-10°C ~ 0°C）：亮蓝色
                                    return '#00008B'; // 极低温（< -10°C）：深蓝色
                                }
                                
                                // 开始动画
                                drawAnimatedCurve();
                            }).exec();
                    }).exec();
            }, 500); // 延迟500毫秒再绘制折线图，让页面先完成渲染
        });
    },

    /*点击生活指数，弹框显示 */
    // 点击 life_item 触发弹框
    showLifeDetail(e) {
        const text = e.currentTarget.dataset.text; // 获取 text
        // 如果文本过长，使用 wx.showModal，否则 wx.showToast
        // if (text.length > 7) {
             wx.showModal({
                 title: "生活指数详情",
                 content: text,
                 showCancel: false
             });
        // } else {
        //wx.showToast({
        //    title: text,
        //    icon: "none",
        //    duration: 2000
        //});
        //}
    },
    /**
     * 生命周期函数--监听页面加载
     */
    onLoad: async function () {
        // 首先检查网络状态
        const networkStatus = await this.checkNetworkStatus();
        
        // 标记是否已经加载了数据，避免重复绘制折线图
        let dataLoaded = false;
        
        // 无论有无网络，都先尝试加载缓存数据确保页面有内容显示
        const hasCachedData = this.loadCachedWeatherData();
        if (hasCachedData) {
            dataLoaded = true;
        }
        
        if (networkStatus === 'none') {
            // 如果无网络，且有缓存数据，显示离线提示
            if (hasCachedData) {
                this.setData({ isOffline: true });
                wx.showToast({
                    title: '无网络，进入离线模式',
                    icon: 'none',
                    duration: 2000
                });
            } else {
                // 无网络且无缓存，显示错误提示
                wx.showToast({
                    title: '无网络且无缓存数据',
                    icon: 'error',
                    duration: 2000
                });
            }
        } else if (!dataLoaded) {
            // 有网络且没有加载过缓存数据时，尝试获取最新数据
            // 确保在联网状态下不显示离线模式
            this.setData({ isOffline: false });
            this.requestLocation();
        } else {
            // 有网络且已加载缓存数据，确保不显示离线模式
            this.setData({ isOffline: false });
        }
        
        // 监听网络状态变化
        wx.onNetworkStatusChange(res => {
            console.log('网络状态变化', res.isConnected, res.networkType);
            if (res.isConnected && this.data.isOffline) {
                // 网络恢复，自动更新数据
                wx.showToast({
                    title: '网络已恢复，正在更新数据',
                    icon: 'none',
                    duration: 2000
                });
                this.requestNetWeatherData();
            } else if (!res.isConnected && !this.data.isOffline) {
                // 网络断开，显示离线提示
                this.setData({
                    isOffline: true
                });
                wx.showToast({
                    title: '网络已断开，切换至离线模式',
                    icon: 'none',
                    duration: 2000
                });
            }
        });
    },

    /**
     * 生命周期函数--监听页面渲染完成
     */
    onReady: function () {
        // 文本溢出检测
        setTimeout(() => {
            const query = wx.createSelectorQuery();
            query.select('.offline-status').boundingClientRect().exec(res => {
                if (res && res[0]) {
                    const container = res[0];
                    
                    // 获取容器内所有文本节点的总宽度
                    const textQuery = wx.createSelectorQuery();
                    textQuery.selectAll('.offline-status text').boundingClientRect().exec(textRes => {
                        if (textRes && textRes[0]) {
                            const texts = textRes[0];
                            let totalTextWidth = 0;
                            
                            // 计算所有文本的总宽度
                            texts.forEach(text => {
                                totalTextWidth += text.width;
                            });
                            
                            // 如果总文本宽度大于容器宽度，说明文本溢出
                            if (totalTextWidth > container.width - 40) { // 减去图标和padding的空间
                                // 设置需要动画的类
                                this.setData({
                                    textOverflow: true
                                });
                            }
                        }
                    });
                }
            });
        }, 500); // 延迟一点时间确保页面已完全渲染
    },

    /**
     * 生命周期函数--监听页面显示。
     * 从address页面返回数据
     */
    onShow: function () {
        // 页面显示时检查是否有新的选中的城市
        const pages = getCurrentPages();
        const prevPage = pages[pages.length - 1]; // 获取当前页面
        if (prevPage.data.selectedCity && Object.keys(prevPage.data.selectedCity).length > 0) {
            const selectedCity = prevPage.data.selectedCity; // 获取完整的城市对象
            console.log('return selectedCity:')
            console.log(selectedCity);
            if (!selectedCity.lat || !selectedCity.lon) {
                console.error("selectedCity 缺少 lat 或 lon:", selectedCity);
                return; // 避免赋值错误
            }
            // this.data.selectedCity.adm1; 北京市
            // this.data.selectedCity.adm2; 北京
            // this.data.selectedCity.lat; 纬度
            // this.data.selectedCity.lon; 经度
            //this.data.selectedCity.name; 丰台
            
            // 如果选择了新城市，需要重置图表状态
            if (this.data.latitude !== selectedCity.lat || this.data.longitude !== selectedCity.lon) {
                this.resetChartState();
                
                this.setData({
                    selectedCity: selectedCity,  // 存储整个对象
                    latitude: selectedCity.lat,  // 赋值纬度
                    longitude: selectedCity.lon  // 赋值经度
                }, () => {
                    // 重新获取位置
                    this.requestLocation();
                    console.log('执行，重新获取位置');
                });
            }
        }
    },

    /**
     * 生命周期函数--监听页面隐藏
     */
    onHide: function () {
    },

    /**
     * 生命周期函数--监听页面卸载
     */
    onUnload: function () {
    },

    /**
     * 页面相关事件处理函数--监听用户下拉动作
     */
    onPullDownRefresh: function () {
        // 重置图表状态，允许重新绘制
        this.resetChartState();
        
        // 请求新数据
        this.requestNetWeatherData().finally(() => {
            // 调用 wx.stopPullDownRefresh()可以停止当前页面的下拉刷新。
            // 在下拉刷新以后，loading 效果有可能不会回弹回去
            wx.stopPullDownRefresh();
        });
    },

    /**
     * 页面上拉触底事件的处理函数
     */
    onReachBottom: function () {
    },

    /**
     * 用户点击右上角分享
     */
    onShareAppMessage: function () {
        // 自定义转发内容
        return{
            title:'太酷啦air',
            path:'/pages/index/index',
            imageUrl:'../../assets/logo.jpg'
        }
    },
    /**
     * 监听右上角 分享到朋友圏 按钮
     */
    onShareTimeline(){
        // 自定义分享的内容
        return{
            title:'太酷啦air',
            imageUrl:'../../assets/logo.jpg'
        }
    },

    // 新增方法：重置图表状态，用于需要重新绘制图表的情况
    resetChartState() {
        this.setData({ chartDrawn: false });
    },

    // 获取网络天气图片
    async requestNetWeatherData() {
        try {
            // 先尝试读取缓存数据，确保在无网络状态下也能显示数据
            let hasCachedData = false;
            
            // 检查网络状态
            const networkType = await this.checkNetworkStatus();
            
            // 如果网络不可用，直接加载缓存数据
            if (networkType === 'none') {
                hasCachedData = this.loadCachedWeatherData();
                if (hasCachedData) {
                    wx.showToast({
                        title: '当前为离线模式',
                        icon: 'none',
                        duration: 2000
                    });
                    return Promise.resolve(); // 成功加载缓存数据，返回成功
                } else {
                    wx.showToast({
                        title: '无网络且无缓存数据',
                        icon: 'none',
                        duration: 2000
                    });
                    return Promise.reject(new Error('网络不可用且无缓存数据'));
                }
            }
            
            // 有网络时，尝试获取新数据
            // 检查是否已有有效的纬度和经度
            let latitude = this.data.latitude;
            let longitude = this.data.longitude;

            // 如果纬度或经度为空，则需要获取地理位置
            if (latitude === '' || longitude === '') {
                try {
                    // 获取当前的地理位置
                    const location = await wx.getLocation();
                    // 获取新的纬度和经度
                    latitude = location.latitude.toFixed(2);
                    longitude = location.longitude.toFixed(2);
                    console.log("获取新的经度：" + longitude + "，纬度：" + latitude);
                } catch (error) {
                    console.error("获取地理位置失败：", error);
                    wx.showToast({
                        title: '获取位置失败，请检查定位权限',
                        icon: 'none',
                        duration: 2000
                    });
                    return Promise.reject(error);
                }
            } else {
                console.log("使用存储的经纬度：" + longitude + "，纬度：" + latitude);
            }

            // 在获取新数据前重置图表状态
            this.resetChartState();

            // 使用获取的或存储的经纬度来进行API请求
            // GeoAPI城市搜索
            const citySearch = await instanceGeoapi.get('/v2/city/lookup', {
                location: longitude + "," + latitude,
                key: "2d57f1cc456d421c8bbdd925db34555a"
            });

            // 获取实时天气
            const weatherNow = await instance.get('/v7/weather/now', {
                location: longitude + "," + latitude,
                key: "2d57f1cc456d421c8bbdd925db34555a"
            });

            // 获取空气质量
            const airQuality = await instance.get('/v7/air/now', {
                location: longitude + "," + latitude,
                key: "2d57f1cc456d421c8bbdd925db34555a"
            });

            // 获取3天的天气预报
            const weather3Day = await instance.get('/v7/weather/3d', {
                location: longitude + "," + latitude,
                key: "2d57f1cc456d421c8bbdd925db34555a"
            });
            const daily3Weather = weather3Day.data.daily.map((day, index) => ({
                dayLabel: ["今天", "明天", "后天"][index],  // 今天、明天、后天
                tempMax: day.tempMax,
                tempMin: day.tempMin,
                iconDay: day.iconDay,
                textDay: day.textDay
            }));

            // 获取逐小时天气预报
            const hour24 = await instance.get('/v7/weather/24h', {
                location: longitude + "," + latitude,
                key: "2d57f1cc456d421c8bbdd925db34555a"
            });
            const hourlyWeather = hour24.data.hourly.map(hour => ({
                time: hour.fxTime.slice(11, 16),  // 提取 "15:00" 格式时间
                temp: hour.temp,  // 温度
                icon: hour.icon  // 图标编号
            }));

            // 获取7天的天气预报
            const weather7Day = await instance.get('/v7/weather/7d', {
                location: longitude + "," + latitude,
                key: "2d57f1cc456d421c8bbdd925db34555a"
            });

            const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
            const daily7Weather = weather7Day.data.daily.map((day, index) => ({
                date: day.fxDate.slice(5),  // 提取 "MM-DD" 格式日期
                weekday: weekdays[new Date(day.fxDate).getDay()],  // 获取星期几
                tempMax: day.tempMax,  // 最高温度
                tempMin: day.tempMin,  // 最低温度
                iconDay: day.iconDay,  // 白天天气图标
                iconNight: day.iconNight,  // 晚上天气图标
                textDay: day.textDay,  // 白天天气描述
                textNight: day.textNight,  // 夜晚天气描述
                windDirDay: day.windDirDay,  // 白天风向
                windScaleDay: day.windScaleDay  // 白天风力等级
            }));

            // 获取生活指数
            const lifeIndex = await instance.get('/v7/indices/1d', {
                location: longitude + "," + latitude,
                key: "2d57f1cc456d421c8bbdd925db34555a",
                type: '1,2,3,4,5,6,8,9,12,13,14,16'
            });
            
            // 获取当前时间作为更新时间
            const now = new Date();
            const lastUpdateTime = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            
            // 更新数据
            const weatherData = {
                cityData: citySearch.data.location[0],
                latitude: latitude,
                longitude: longitude,
                shishitianqi: weatherNow.data.now,
                zhiliang: airQuality.data.now.category,
                daily3Weather: daily3Weather,
                hourlyWeather: hourlyWeather,
                daily7Weather: daily7Weather,
                lifeIndices: lifeIndex.data.daily,
                lastUpdateTime: lastUpdateTime,
                isOffline: false
            };
            
            this.setData(weatherData);
            
            // 缓存天气数据到本地
            this.cacheWeatherData(weatherData);
            
            // 延迟绘制折线图，让页面先完成渲染
            // 确保图表尚未绘制时才执行绘制
            if (!this.data.chartDrawn) {
                setTimeout(() => {
                    this.zhexiantu();  // 等待绘制图表
                }, 300);
            }
            
            // 返回成功的Promise
            return Promise.resolve();
        } catch (error) {
            console.error("请求失败：", error);
            
            // 请求失败时，尝试读取缓存数据
            const success = this.loadCachedWeatherData();
            if (success) {
                wx.showToast({
                    title: '网络异常，正在使用缓存数据',
                    icon: 'none',
                    duration: 2000
                });
            } else {
                wx.showToast({
                    title: '网络异常，无缓存数据',
                    icon: 'none',
                    duration: 2000
                });
            }
            
            // 返回失败的Promise
            return Promise.reject(error);
        }
    },
})