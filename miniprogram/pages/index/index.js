// index.js
import '../../utils/extendApi'
import WxRequest from 'mina-request'


// 对 WxRequest 进行实例化
const instance = new WxRequest({
    baseURL: 'https://devapi.qweather.com', // 使用时请换成真实接口
    timeout: 10000, // 超时时长
    isLoading: false // 是否使用默认的 loading 效果
})
const instanceGeoapi = new WxRequest({
    baseURL: 'https://geoapi.qweather.com', // 使用时请换成真实接口
    timeout: 10000, // 超时时长
    isLoading: false // 是否使用默认的 loading 效果
})

Page({
    /**
     * 页面的初始数据
     */
    data: {
        // 地理位置
        latitude: '',
        longitude: '',
        
        // 城市数据
        cityData: null,
        selectedCity: null, // 从地址页面选择的城市
        
        // 天气数据
        shishitianqi: null,
        zhiliang: '',
        daily3Weather: [],
        hourlyWeather: [],
        daily7Weather: [],
        lifeIndices: [],
        
        // 更新时间
        lastUpdateTime: '',
        
        // 天气特效相关
        weatherEffect: '', // 当前天气效果类型：rain, lightRain, snow, sunny, cloudy, overcast, sandstorm, fog, haze, thunder
        raindrops: [], // 雨滴数据
        snowflakes: [], // 雪花数据
        sunrays: [], // 阳光射线数据
        clouds: [], // 云朵数据
        overcastClouds: [], // 阴天云朵数据
        stars: [], // 星星数据
        sandParticles: [], // 沙尘暴粒子数据
        fogParticles: [], // 雾粒子数据
        hazeParticles: [], // 霾粒子数据
        lightnings: [], // 闪电数据
        
        // 雨滴池系统
        raindropPool: {
            activeCount: 0,       // 当前活跃的雨滴数量
            maxCount: 40,         // 最大雨滴数量（减少DOM元素数量）
            poolReady: false,     // 雨滴池是否准备好
            intensity: 'heavy',   // 雨强度: 'heavy', 'light'
            heartbeatActive: false // 心跳机制是否激活
        },
        
        // 雪花池系统 - 新增
        snowflakePool: {
            activeCount: 0,       // 当前活跃的雪花数量
            maxCount: 40,         // 最大雪花数量（减少DOM元素数量）
            poolReady: false,     // 雪花池是否准备好
            heartbeatActive: false // 心跳机制是否激活
        },
        
        forceRainEffect: false, // 是否强制显示雨效果
        forceLightRainEffect: false, // 是否强制显示小雨效果
        forceSnowEffect: false, // 是否强制显示雪效果
        forceSunnyEffect: false, // 是否强制显示晴天效果
        forceCloudyEffect: false, // 是否强制显示多云效果
        forceOvercastEffect: false, // 是否强制显示阴天效果
        forceSandstormEffect: false, // 是否强制显示沙尘暴效果
        forceFogEffect: false, // 是否强制显示雾效果
        forceHazeEffect: false, // 是否强制显示霾效果
        forceThunderEffect: false, // 是否强制显示打雷效果
        
        // 状态标志
        isOffline: false, // 是否处于离线模式
        chartDrawn: false, // 图表是否已绘制
        statusBarHeight: 0, // 状态栏高度
        diagonalRayAngle: 45, // 新增斜光角度
        diagonalRayTimer: null, // 新增斜光角度更新定时器
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
                        title: '无网络连接',
                        icon: 'none',
                        duration: 2000
                    });
                    return;
                }
            }
            
            // 保存当前的isRaining状态
            const wasRaining = this.data.isRaining;
            
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

            // 验证城市搜索响应数据
            if (!citySearch.data || !citySearch.data.location || !citySearch.data.location[0]) {
                throw new Error('城市搜索API返回数据无效');
            }

            // 获取实时天气
            const weatherNow = await instance.get('/v7/weather/now', {
                location: longitude + "," + latitude,
                key: "2d57f1cc456d421c8bbdd925db34555a"
            });
            
            // 打印完整的weatherNow数据，方便查看实时天气数据结构
            console.log("实时天气数据 weatherNow:", JSON.stringify(weatherNow.data, null, 2));
            
            // 验证实时天气响应数据
            if (!weatherNow.data || !weatherNow.data.now) {
                throw new Error('实时天气API返回数据无效');
            }

            // 获取空气质量
            const airQuality = await instance.get('/v7/air/now', {
                location: longitude + "," + latitude,
                key: "2d57f1cc456d421c8bbdd925db34555a"
            });
            
            // 验证空气质量响应数据
            if (!airQuality.data || !airQuality.data.now) {
                throw new Error('空气质量API返回数据无效');
            }

            // 获取3天的天气预报
            const weather3Day = await instance.get('/v7/weather/3d', {
                location: longitude + "," + latitude,
                key: "2d57f1cc456d421c8bbdd925db34555a"
            });
            
            // 验证3天天气预报响应数据
            if (!weather3Day.data || !weather3Day.data.daily || !weather3Day.data.daily.length) {
                throw new Error('3天天气预报API返回数据无效');
            }
            
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
            
            // 验证24小时天气预报响应数据
            if (!hour24.data || !hour24.data.hourly || !hour24.data.hourly.length) {
                throw new Error('24小时天气预报API返回数据无效');
            }
            
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
            
            // 验证7天天气预报响应数据
            if (!weather7Day.data || !weather7Day.data.daily || !weather7Day.data.daily.length) {
                throw new Error('7天天气预报API返回数据无效');
            }

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
            
            // 验证生活指数响应数据
            if (!lifeIndex.data || !lifeIndex.data.daily || !lifeIndex.data.daily.length) {
                throw new Error('生活指数API返回数据无效');
            }
            
            // 获取当前时间作为更新时间
            const now = new Date();
            const lastUpdateTime = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            
            // 检查是否是雨天
            const isRaining = this.checkIfRaining(weatherNow.data.now.text);
            
            // 如果检测到是雨天或者之前已经在下雨，生成雨滴
            const shouldRain = isRaining || wasRaining;
            if (shouldRain) {
                this.generateRaindrops();
            }
            
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
                isOffline: false,  // 明确设置为非离线模式
                isRaining: shouldRain  // 设置是否下雨，保留之前的雨天状态
            };
            
            this.setData(weatherData, () => {
                // 数据更新后确保雨效果依然显示
                this.ensureRainEffect();
            });
            
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
            
            // 添加更详细的错误日志
            console.error("请求失败详情：", {
                errorName: error.name,
                errorMessage: error.message,
                errorStack: error.stack,
                networkType: await this.checkNetworkStatus()
            });
            
            // 请求失败时，尝试读取缓存数据
            const success = this.loadCachedWeatherData();
            if (success) {
                // 设置离线状态标志
                this.setData({ isOffline: true });
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
            console.log("网络状态:", res.networkType);
            
            // 如果没有网络，设置离线模式
            if (res.networkType === 'none') {
                this.setData({
                    isOffline: true
                });
                return 'none';
            } else {
                this.setData({
                    isOffline: false
                });
                return res.networkType;
            }
        } catch (error) {
            console.error("获取网络状态失败:", error);
            // 如果获取网络状态失败，假设是离线状态
            this.setData({
                isOffline: true
            });
            return 'none';
        }
    },
    
    // 新增方法：缓存天气数据
    cacheWeatherData(weatherData) {
        try {
            wx.setStorageSync('cachedWeatherData', weatherData);
            wx.setStorageSync('weatherCacheTime', new Date().getTime());
            console.log("天气数据已缓存");
        } catch (e) {
            console.error("缓存天气数据失败:", e);
        }
    },
    
    // 新增方法：加载缓存的天气数据
    loadCachedWeatherData() {
        try {
            const cachedData = wx.getStorageSync('cachedWeatherData');
            const cacheTime = wx.getStorageSync('weatherCacheTime');
            
            if (cachedData && cacheTime) {
                const now = new Date().getTime();
                const cacheAge = now - cacheTime;
                const maxCacheAge = 24 * 60 * 60 * 1000; // 24小时
                
                // 格式化缓存时间为可读字符串
                const cacheDate = new Date(cacheTime);
                const formattedCacheTime = `${cacheDate.getFullYear()}-${(cacheDate.getMonth()+1).toString().padStart(2, '0')}-${cacheDate.getDate().toString().padStart(2, '0')} ${cacheDate.getHours().toString().padStart(2, '0')}:${cacheDate.getMinutes().toString().padStart(2, '0')}`;
                
                // 检查缓存是否过期
                if (cacheAge > maxCacheAge) {
                    console.log("缓存已过期");
                    return false;
                }
                
                // 设置数据，包括离线模式标志和上次更新时间
                this.setData({
                    ...cachedData,
                    isOffline: true,
                    lastUpdateTime: formattedCacheTime
                });
                
                console.log("已加载缓存的天气数据，上次更新时间:", formattedCacheTime);
                
                // 根据缓存的天气数据设置天气效果
                if (cachedData.shishitianqi && cachedData.shishitianqi.text) {
                    const weatherType = this.checkWeatherType(cachedData.shishitianqi.text);
                    this.setWeatherEffect(weatherType);
                }
                
                // 如果有7天预报数据，绘制图表
                if (cachedData.daily7Weather && cachedData.daily7Weather.length > 0) {
                    // 延迟一下再绘制图表，确保DOM已经渲染
                    setTimeout(() => {
                        this.zhexiantu();
                    }, 500);
                }
                
                return true;
            }
            
            console.log("没有找到缓存的天气数据");
            return false;
        } catch (e) {
            console.error("加载缓存天气数据失败:", e);
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
                const tempRangeExpansion = 1; // 温度范围调整系数（值越大，两条线间距越大）
                const tempDiff = maxTemp - minTemp; // 原始温度差
                const adjustedMaxTemp = maxTemp + tempDiff * (1 - tempRangeExpansion) / 2; // 向上扩展
                const adjustedMinTemp = minTemp - tempDiff * (1 - tempRangeExpansion) / 2; // 向下扩展

                // 使用wx.createSelectorQuery()获取canvas的宽度和容器宽度
                wx.createSelectorQuery()
                    .select('.chart-container')
                    .boundingClientRect(containerRect => {
                        const containerWidth = containerRect.width;
                        
                        wx.createSelectorQuery()
                            .select('.yubao7day_container')
                            .boundingClientRect(itemsRect => {
                                const chartWidth = containerWidth || 350;  // 获取容器宽度，默认350
                                const chartHeight = 120; // 图表高度
                                const margin = 23;       // 边距
                                
                                // 计算每个点的间隔，确保对齐
                                const items = daily7Weather.length;
                                // 确保分段数量与上下的元素对齐
                                const stepX = (chartWidth - 2 * margin) / (items - 1)-1.5;
                                
                                // 优化动画，减少闪烁
                                let animationProgress = 0; // 动画进度，从0到1
                                const animationDuration = 8; // 减少帧数，让动画更快完成
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
                                    
                                    // 绘制点和文本（直接显示，不使用渐变出现效果，减少复杂度）
                                    if (animationProgress >= 0.3) { // 当曲线达到30%高度时就显示点和文本
                                        // 固定不透明度为1，不再使用渐变动画
                                        const opacity = 1; 
                                        
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
                                                ctx.setFontSize(15); // 调整字体大小
                                                ctx.fillText(high.temp + '°', high.x - 10, high.y - 10);
                                                
                                                // 最低温点
                                                ctx.beginPath();
                                                ctx.arc(low.x, low.y, 4, 0, 2 * Math.PI);
                                                ctx.setFillStyle(`rgba(${hexToRgb(low.color)}, ${opacity})`);
                                                ctx.fill();
                                                ctx.setFillStyle(`rgba(${hexToRgb(low.color)}, ${opacity})`);
                                                ctx.setFontSize(15); // 调整字体大小
                                                ctx.fillText(low.temp + '°', low.x - 10, low.y + 20);
                                            }
                                        }
                                    }
                                    
                                    // 绘制并更新画布 - 使用同步模式避免闪烁
                                    ctx.draw(false, () => {
                                        // 继续动画
                                        if (currentFrame < animationDuration) {
                                            currentFrame++;
                                            // 使用requestAnimationFrame获得更好的性能
                                            wx.nextTick(() => {
                                                drawAnimatedCurve();
                                            });
                                        } else {
                                            // 动画完成，标记图表已绘制
                                            this.setData({ chartDrawn: true });
                                            resolve(); // 完成Promise
                                        }
                                    });
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
    onLoad: async function (options) {
        console.log("页面加载");
        
        // 初始化数据
        this.setData({
            latitude: '',
            longitude: '',
            weatherEffect: '', // 初始为空，将根据天气文本设置
            raindrops: [],
            snowflakes: [],
            sunrays: [],
            clouds: [],
            overcastClouds: [],
            stars: [],
            sandParticles: [],
            fogParticles: [],
            hazeParticles: [],
            lightnings: [],
            forceRainEffect: false, // 是否强制显示雨效果
            forceLightRainEffect: false, // 是否强制显示小雨效果
            forceSnowEffect: false, // 是否强制显示雪效果
            forceSunnyEffect: false, // 是否强制显示晴天效果
            forceCloudyEffect: false, // 是否强制显示多云效果
            forceOvercastEffect: false, // 是否强制显示阴天效果
            forceSandstormEffect: false, // 是否强制显示沙尘暴效果
            forceFogEffect: false, // 是否强制显示雾效果
            forceHazeEffect: false, // 是否强制显示霾效果
            forceThunderEffect: false, // 是否强制显示打雷效果
            chartDrawn: false
        });

        // 获取系统信息设置顶部状态栏高度
        wx.getSystemInfo({
            success: (res) => {
                this.setData({
                    statusBarHeight: res.statusBarHeight
                });
            }
        });

        // 检查是否有传入的强制显示雨效果参数
        if (options && options.forceRain === 'true') {
            this.setData({ forceRainEffect: true, forceLightRainEffect: false, forceSnowEffect: false, forceSunnyEffect: false, forceCloudyEffect: false, forceOvercastEffect: false });
        }
        
        // 检查是否有传入的强制显示小雨效果参数
        if (options && options.forceLightRain === 'true') {
            this.setData({ forceRainEffect: false, forceLightRainEffect: true, forceSnowEffect: false, forceSunnyEffect: false, forceCloudyEffect: false, forceOvercastEffect: false });
        }

        // 检查是否有传入的强制显示雪效果参数
        if (options && options.forceSnow === 'true') {
            this.setData({ forceRainEffect: false, forceLightRainEffect: false, forceSnowEffect: true, forceSunnyEffect: false, forceCloudyEffect: false, forceOvercastEffect: false });
        }

        // 检查是否有传入的强制显示晴天效果参数
        if (options && options.forceSunny === 'true') {
            this.setData({ forceRainEffect: false, forceLightRainEffect: false, forceSnowEffect: false, forceSunnyEffect: true, forceCloudyEffect: false, forceOvercastEffect: false });
        }

        // 检查是否有传入的强制显示多云效果参数
        if (options && options.forceCloudy === 'true') {
            this.setData({ forceRainEffect: false, forceLightRainEffect: false, forceSnowEffect: false, forceSunnyEffect: false, forceCloudyEffect: true, forceOvercastEffect: false });
        }

        // 检查是否有传入的强制显示阴天效果参数
        if (options && options.forceOvercast === 'true') {
            this.setData({ forceRainEffect: false, forceLightRainEffect: false, forceSnowEffect: false, forceSunnyEffect: false, forceCloudyEffect: false, forceOvercastEffect: true, forceSandstormEffect: false, forceFogEffect: false, forceHazeEffect: false, forceThunderEffect: false });
        }

        // 检查是否有传入的强制显示沙尘暴效果参数
        if (options && options.forceSandstorm === 'true') {
            this.setData({ forceRainEffect: false, forceSnowEffect: false, forceSunnyEffect: false, forceCloudyEffect: false, forceOvercastEffect: false, forceSandstormEffect: true, forceFogEffect: false, forceHazeEffect: false, forceThunderEffect: false });
        }
        
        // 检查是否有传入的强制显示雾效果参数
        if (options && options.forceFog === 'true') {
            this.setData({ forceRainEffect: false, forceSnowEffect: false, forceSunnyEffect: false, forceCloudyEffect: false, forceOvercastEffect: false, forceSandstormEffect: false, forceFogEffect: true, forceHazeEffect: false, forceThunderEffect: false });
        }
        
        // 检查是否有传入的强制显示霾效果参数
        if (options && options.forceHaze === 'true') {
            this.setData({ forceRainEffect: false, forceSnowEffect: false, forceSunnyEffect: false, forceCloudyEffect: false, forceOvercastEffect: false, forceSandstormEffect: false, forceFogEffect: false, forceHazeEffect: true, forceThunderEffect: false });
        }
        
        // 检查是否有传入的强制显示打雷效果参数
        if (options && options.forceThunder === 'true') {
            this.setData({ forceRainEffect: false, forceSnowEffect: false, forceSunnyEffect: false, forceCloudyEffect: false, forceOvercastEffect: false, forceSandstormEffect: false, forceFogEffect: false, forceHazeEffect: false, forceThunderEffect: true });
        }

        // 首先检查网络状态
        const networkStatus = await this.checkNetworkStatus();
        
        // 标记是否已经加载了数据，避免重复绘制折线图
        let dataLoaded = false;
        
        if (networkStatus === 'none') {
            // 如果无网络，尝试加载缓存数据
            const hasCachedData = this.loadCachedWeatherData();
            if (hasCachedData) {
                dataLoaded = true;
                this.setData({ isOffline: true });
                wx.showToast({
                    title: '无网络连接',
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
                // 无数据时显示默认天气效果
                this.generateSunnyEffect();
            }
        } else {
            // 有网络时，优先请求最新数据
            this.setData({ isOffline: false });
            try {
                // 尝试请求最新的网络数据
                await this.requestNetWeatherData();
                dataLoaded = true;
            } catch (error) {
                console.error("获取网络数据失败，尝试加载缓存", error);
                // 网络请求失败，尝试加载缓存数据
                const hasCachedData = this.loadCachedWeatherData();
                if (hasCachedData) {
                    dataLoaded = true;
                    wx.showToast({
                        title: '网络请求失败，使用缓存数据',
                        icon: 'none',
                        duration: 2000
                    });
                } else {
                    wx.showToast({
                        title: '获取数据失败且无缓存数据',
                        icon: 'error',
                        duration: 2000
                    });
                    // 无数据时显示默认天气效果
                    this.generateSunnyEffect();
                }
            }
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
                
                // 重置图表状态，允许重新绘制
                this.resetChartState();
                
                // 尝试请求新数据
                this.requestNetWeatherData().catch(error => {
                    console.error('网络恢复后请求数据失败:', error);
                    // 请求失败时显示提示，但保持离线模式
                    wx.showToast({
                        title: '获取新数据失败，继续使用缓存',
                        icon: 'none',
                        duration: 2000
                    });
                });
            } else if (!res.isConnected && !this.data.isOffline) {
                // 网络断开，显示离线提示
                this.setData({
                    isOffline: true
                });
                wx.showToast({
                    title: '无网络连接',
                    icon: 'none',
                    duration: 2000
                });
            }
        });
        
        // 确保强制显示的天气效果生效
        this.ensureForcedWeatherEffects();
    },
    
    // 新增方法：确保强制显示的天气效果生效
    ensureForcedWeatherEffects() {
        // 如果强制显示雨效果，则在页面加载后强制显示
        if (this.data.forceRainEffect) {
            this.forceRainEffect();
            
            // 设置延迟定时器，确保雨效果持续显示
            setTimeout(() => {
                this.ensureRainEffect();
            }, 2000);
        }
        
        // 如果强制显示小雨效果，则在页面加载后强制显示
        else if (this.data.forceLightRainEffect) {
            this.forceLightRainEffect();
            
            // 设置延迟定时器，确保小雨效果持续显示
            setTimeout(() => {
                this.ensureLightRainEffect();
            }, 2000);
        }
        
        // 如果强制显示雪效果，则在页面加载后强制显示
        else if (this.data.forceSnowEffect) {
            this.forceSnowEffect();
            
            // 设置延迟定时器，确保雪效果持续显示
            setTimeout(() => {
                this.ensureSnowEffect();
            }, 2000);
        }
        
        // 如果强制显示晴天效果，则在页面加载后强制显示
        else if (this.data.forceSunnyEffect) {
            this.forceSunnyEffect();
            
            // 设置延迟定时器，确保晴天效果持续显示
            setTimeout(() => {
                this.ensureSunnyEffect();
            }, 2000);
        }
        
        // 如果强制显示多云效果，则在页面加载后强制显示
        else if (this.data.forceCloudyEffect) {
            this.forceCloudyEffect();
            
            // 设置延迟定时器，确保多云效果持续显示
            setTimeout(() => {
                this.ensureCloudyEffect();
            }, 2000);
        }
        
        // 如果强制显示阴天效果，则在页面加载后强制显示
        else if (this.data.forceOvercastEffect) {
            this.forceOvercastEffect();
            
            // 设置延迟定时器，确保阴天效果持续显示
            setTimeout(() => {
                this.ensureOvercastEffect();
            }, 2000);
        }
        
        // 确保沙尘暴效果显示
        else if (this.data.forceSandstormEffect) {
            this.ensureSandstormEffect();
        }
        
        // 确保雾效果显示
        else if (this.data.forceFogEffect) {
            this.ensureFogEffect();
        }
        
        // 确保霾效果显示
        else if (this.data.forceHazeEffect) {
            this.ensureHazeEffect();
        }
        
        // 确保打雷效果显示
        else if (this.data.forceThunderEffect) {
            this.forceThunderEffect();
            
            // 设置延迟定时器，确保打雷效果持续显示
            setTimeout(() => {
                this.ensureThunderEffect();
            }, 2000);
        }
    },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady: function () {
        console.log("页面初次渲染完成");
        
        // 请求天气数据
        this.requestNetWeatherData().then(() => {
            console.log("天气数据请求成功");
            
            // 如果强制显示雨效果，则在数据加载后确保雨效果显示
            if (this.data.forceRainEffect) {
                // 延迟执行，确保在天气数据加载后仍然显示雨效果
                setTimeout(() => {
                    this.ensureRainEffect();
                }, 500);
            }
            
            // 如果强制显示小雨效果，则在数据加载后确保小雨效果显示
            if (this.data.forceLightRainEffect) {
                // 延迟执行，确保在天气数据加载后仍然显示小雨效果
                setTimeout(() => {
                    this.ensureLightRainEffect();
                }, 500);
            }
            
            // 如果强制显示雪效果，则在数据加载后确保雪效果显示
            if (this.data.forceSnowEffect) {
                // 延迟执行，确保在天气数据加载后仍然显示雪效果
                setTimeout(() => {
                    this.ensureSnowEffect();
                }, 500);
            }
            
            // 如果强制显示晴天效果，则在数据加载后确保晴天效果显示
            if (this.data.forceSunnyEffect) {
                // 延迟执行，确保在天气数据加载后仍然显示晴天效果
                setTimeout(() => {
                    this.ensureSunnyEffect();
                }, 500);
            }
            
            // 如果强制显示多云效果，则在数据加载后确保多云效果显示
            if (this.data.forceCloudyEffect) {
                // 延迟执行，确保在天气数据加载后仍然显示多云效果
                setTimeout(() => {
                    this.ensureCloudyEffect();
                }, 500);
            }
            
            // 如果强制显示阴天效果，则在数据加载后确保阴天效果显示
            if (this.data.forceOvercastEffect) {
                // 延迟执行，确保在天气数据加载后仍然显示阴天效果
                setTimeout(() => {
                    this.ensureOvercastEffect();
                }, 500);
            }
            
            // 如果强制显示沙尘暴效果，则在数据加载后确保沙尘暴效果显示
            if (this.data.forceSandstormEffect) {
                // 延迟执行，确保在天气数据加载后仍然显示沙尘暴效果
                setTimeout(() => {
                    this.ensureSandstormEffect();
                }, 500);
            }
            
            // 如果强制显示雾效果，则在数据加载后确保雾效果显示
            if (this.data.forceFogEffect) {
                // 延迟执行，确保在天气数据加载后仍然显示雾效果
                setTimeout(() => {
                    this.ensureFogEffect();
                }, 500);
            }
            
            // 如果强制显示霾效果，则在数据加载后确保霾效果显示
            if (this.data.forceHazeEffect) {
                // 延迟执行，确保在天气数据加载后仍然显示霾效果
                setTimeout(() => {
                    this.ensureHazeEffect();
                }, 500);
            }
            
            // 如果强制显示打雷效果，则在数据加载后确保打雷效果显示
            if (this.data.forceThunderEffect) {
                // 延迟执行，确保在天气数据加载后仍然显示打雷效果
                setTimeout(() => {
                    this.ensureThunderEffect();
                }, 500);
            }
        }).catch(error => {
            console.error("天气数据请求失败：", error);
        });
    },

    /**
     * 生命周期函数--监听页面显示。
     * 从address页面返回数据
     */
    onShow: function () {
        // 检查是否有从地址页面选择的城市
        if (this.data.selectedCity) {
            console.log("检测到选择的城市:", this.data.selectedCity);
            
            // 更新城市数据
            this.setData({
                cityData: this.data.selectedCity,
                latitude: this.data.selectedCity.lat,
                longitude: this.data.selectedCity.lon
            });
            
            // 使用选中城市的经纬度请求天气数据
            this.requestNetWeatherData().then(() => {
                console.log("已更新选中城市的天气数据");
                
                // 清除selectedCity数据，防止再次进入页面时重复处理
                this.setData({
                    selectedCity: null
                });
            }).catch(error => {
                console.error("获取选中城市天气数据失败:", error);
            });
            
            // 已经处理了选中城市，不需要执行后续的天气效果代码
            return;
        }
        
        // 确保雨效果显示
        if (this.data.forceRainEffect) {
            this.ensureRainEffect();
        }
        
        // 确保小雨效果显示
        if (this.data.forceLightRainEffect) {
            this.ensureLightRainEffect();
        }
        
        // 确保雪效果显示
        if (this.data.forceSnowEffect) {
            this.ensureSnowEffect();
        }
        
        // 确保晴天效果显示
        if (this.data.forceSunnyEffect) {
          this.ensureSunnyEffect();
        }

        // 确保多云效果显示
        if (this.data.forceCloudyEffect) {
          this.ensureCloudyEffect();
        }

        // 确保阴天效果显示
        if (this.data.forceOvercastEffect) {
          this.ensureOvercastEffect();
        }
        
        // 确保沙尘暴效果显示
        if (this.data.forceSandstormEffect) {
          this.ensureSandstormEffect();
        }
        
        // 确保雾效果显示
        if (this.data.forceFogEffect) {
          this.ensureFogEffect();
        }
        
        // 确保霾效果显示
        if (this.data.forceHazeEffect) {
          this.ensureHazeEffect();
        }
        
        // 确保打雷效果显示
        if (this.data.forceThunderEffect) {
          this.ensureThunderEffect();
        }

        // 检查网络状态
        this.checkNetworkStatus()
          .then(isOnline => {
            if (!isOnline) {
              wx.showToast({
                title: '网络不可用',
                icon: 'none',
                duration: 2000
              });
              wx.stopPullDownRefresh();
              return;
            }
            // 请求新的天气数据
            this.requestNetWeatherData();
          })
          .catch(error => {
            console.error('检查网络状态失败:', error);
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
    
    /**
     * 页面相关事件处理函数--监听用户下拉动作
     */
    onPullDownRefresh: function() {
        console.log("用户下拉刷新");
        
        // 重置图表状态，允许重新绘制
        this.resetChartState();
        
        // 检查网络状态
        this.checkNetworkStatus().then(networkType => {
            if (networkType === 'none') {
                wx.showToast({
                    title: '无网络连接',
                    icon: 'none',
                    duration: 2000
                });
                wx.stopPullDownRefresh();
                return;
            }
            
            // 请求新的天气数据
            this.requestNetWeatherData().then(() => {
                // 确保天气效果显示
                if (this.data.forceRainEffect) {
                    this.ensureRainEffect();
                } else if (this.data.forceLightRainEffect) {
                    this.ensureLightRainEffect();
                } else if (this.data.forceSnowEffect) {
                    this.ensureSnowEffect();
                } else if (this.data.forceSunnyEffect) {
                    this.ensureSunnyEffect();
                } else if (this.data.forceCloudyEffect) {
                    this.ensureCloudyEffect();
                } else if (this.data.forceOvercastEffect) {
                    this.ensureOvercastEffect();
                } else if (this.data.forceSandstormEffect) {
                    this.ensureSandstormEffect();
                } else if (this.data.forceFogEffect) {
                    this.ensureFogEffect();
                } else if (this.data.forceHazeEffect) {
                    this.ensureHazeEffect();
                } else if (this.data.forceThunderEffect) {
                    this.ensureThunderEffect();
                }
                
                // 移除刷新成功的弹框提示
                // wx.showToast({
                //     title: '刷新成功',
                //     icon: 'success',
                //     duration: 1500
                // });
                
                wx.stopPullDownRefresh();
            }).catch(error => {
                console.error("刷新数据失败：", error);
                wx.showToast({
                    title: '刷新失败',
                    icon: 'none',
                    duration: 2000
                });
                wx.stopPullDownRefresh();
            });
        });
    },

    // 新增方法：重置图表状态，用于需要重新绘制图表的情况
    resetChartState() {
        this.setData({
            chartDrawn: false
        });
    },

    // 检查天气是否为雨天
    checkIfRaining(weatherText) {
        // 扩大包含雨的天气描述关键词
        const rainKeywords = ['雨', '阵雨', '小雨', '中雨', '大雨', '暴雨', '雷阵雨', '毛毛雨', '雨夹雪', '雷', '雪'];
        
        // 检查是否包含任何雨相关关键词
        const isRain = rainKeywords.some(keyword => weatherText.includes(keyword));
        
        // 为了测试，强制启用雨效果
        return true; // 强制显示雨效果
        
        // return isRain; // 正常逻辑
    },
    
    // 检查天气类型并设置相应特效
    checkWeatherType(weatherText) {
        // 打雷和大雨相关关键词（已合并）
        const thunderKeywords = ['雷', '雷阵雨', '雷电', '打雷', '雷暴', '雷雨', '强雷阵雨', '雷阵雨伴有冰雹', '大雨', '暴雨', '大暴雨', '特大暴雨', '强降雨', '极端降雨', '大到暴雨', '暴雨到大暴雨', '大暴雨到特大暴雨'];
        // 小雨相关关键词（包含原来的中雨关键词）
        const lightRainKeywords = ['雨', '小雨', '毛毛雨', '细雨', '微雨', '阵雨', '中雨', '强阵雨', '小到中雨', '中到大雨', '冻雨', '毛毛雨/细雨'];
        // 雪相关关键词
        const snowKeywords = ['雪', '小雪', '中雪', '大雪', '暴雪', '雨夹雪', '雨雪天气', '阵雨夹雪', '阵雪', '小到中雪', '中到大雪', '大到暴雪'];
        // 晴天相关关键词
        const sunnyKeywords = ['晴', '晴天'];
        // 多云相关关键词
        const cloudyKeywords = ['多云', '局部多云', '晴间多云', '少云'];
        // 阴天相关关键词
        const overcastKeywords = ['阴', '阴天'];
        // 沙尘暴相关关键词
        const sandstormKeywords = ['沙尘暴', '扬沙', '浮尘', '沙尘', '强沙尘暴'];
        // 雾相关关键词
        const fogKeywords = ['雾', '大雾', '浓雾', '强浓雾', '特强浓雾', '雾霾', '薄雾', '大雾', '特强浓雾'];
        // 霾相关关键词
        const hazeKeywords = ['霾', '轻度霾', '中度霾', '重度霾', '严重霾'];
        
        // 检查天气类型
        if (thunderKeywords.some(keyword => weatherText.includes(keyword))) {
            return 'thunder'; // 打雷优先级最高
        } else if (lightRainKeywords.some(keyword => weatherText.includes(keyword))) {
            return 'lightRain'; // 小雨（现在包含中雨）
        } else if (snowKeywords.some(keyword => weatherText.includes(keyword))) {
            return 'snow';
        } else if (sandstormKeywords.some(keyword => weatherText.includes(keyword))) {
            return 'sandstorm';
        } else if (hazeKeywords.some(keyword => weatherText.includes(keyword))) {
            return 'haze';
        } else if (fogKeywords.some(keyword => weatherText.includes(keyword))) {
            return 'fog';
        } else if (overcastKeywords.some(keyword => weatherText.includes(keyword))) {
            return 'overcast';
        } else if (cloudyKeywords.some(keyword => weatherText.includes(keyword))) {
            return 'cloudy';
        } else if (sunnyKeywords.some(keyword => weatherText.includes(keyword))) {
            return 'sunny';
        }
        
        // 默认返回晴天
        return 'sunny';
    },
    
    // 生成雨滴效果 (现在作为大雨效果)
    generateRaindrops() {
        // 初始化雨滴池
        this.initRaindropPool('heavy');
        
        this.setData({ 
            weatherEffect: 'rain'
        });
        
        // 启动心跳机制
        this.startRaindropHeartbeat();
    },
    
    // 新增方法：生成小雨效果
    generateLightRaindrops() {
        // 初始化雨滴池，但设置为小雨强度
        this.initRaindropPool('light');
        
        this.setData({ 
            weatherEffect: 'lightRain'
        });
        
        // 启动心跳机制
        this.startRaindropHeartbeat();
    },
    
    // 新增方法：初始化雨滴池
    initRaindropPool(intensity) {
        // 停止现有心跳
        this.stopRaindropHeartbeat();
        
        // 根据强度调整最大雨滴数
        let maxCount = intensity === 'heavy' ? 30 : 25;
        
        // 创建初始雨滴池
        const raindrops = [];
        
        for (let i = 0; i < maxCount; i++) {
            raindrops.push(this.createRaindrop(intensity, i));
        }
        
        this.setData({ 
            raindrops,
            'raindropPool.activeCount': maxCount,
            'raindropPool.maxCount': maxCount,
            'raindropPool.intensity': intensity,
            'raindropPool.poolReady': true
        });
    },
    
    // 新增方法：创建单个雨滴
    createRaindrop(intensity, index) {
        // 根据强度设置不同的雨滴参数
        let width, height, duration, opacity;
        
        if (intensity === 'heavy') {
            // 大雨雨滴
            const sizeVariant = index % 3;
            
            switch(sizeVariant) {
                case 0: // 小雨滴
                    width = '2rpx';
                    height = '45rpx';
                    break;
                case 1: // 中雨滴
                    width = '3rpx';
                    height = '60rpx';
                    break;
                case 2: // 大雨滴
                    width = '4rpx';
                    height = '75rpx';
                    break;
            }
            
            // 大雨速度更快
            duration = (0.6 + (index % 3) * 0.3) + 's';
            opacity = 0.7;
        } else {
            // 小雨雨滴
            const sizeVariant = index % 3;
            
            switch(sizeVariant) {
                case 0: // 极小雨滴
                    width = '1rpx';
                    height = '35rpx';
                    break;
                case 1: // 小雨滴
                    width = '1.5rpx';
                    height = '45rpx';
                    break;
                case 2: // 中等雨滴
                    width = '2rpx';
                    height = '50rpx';
                    break;
            }
            
            // 小雨速度更慢
            duration = (1.0 + (index % 3) * 0.3) + 's';
            opacity = 0.65;
        }
        
        // 随机位置
        const left = Math.random() * 100;
        const top = Math.random() * -50; // 起始位置在屏幕上方
        
        return {
            left: left + 'vw',
            top: top + 'vh',
            delay: '0s', // 不使用延迟，由心跳控制
            duration: duration,
            width: width,
            height: height,
            opacity: opacity,
            active: true, // 标记雨滴是否活跃
            id: index // 为雨滴添加唯一ID
        };
    },
    
    // 新增方法：启动雨滴心跳机制
    startRaindropHeartbeat() {
        // 如果心跳已经激活，则不重复启动
        if (this.data.raindropPool.heartbeatActive) {
            return;
        }
        
        // 设置心跳状态为激活
        this.setData({
            'raindropPool.heartbeatActive': true
        });
        
        // 创建心跳间隔，控制雨滴的重用
        this.raindropHeartbeat = setInterval(() => {
            // 检查是否应该继续心跳
            if (!this.data.raindropPool.heartbeatActive || 
                (this.data.weatherEffect !== 'rain' && this.data.weatherEffect !== 'lightRain')) {
                this.stopRaindropHeartbeat();
                return;
            }
            
            // 获取当前雨滴数组的副本
            const raindrops = [...this.data.raindrops];
            let updated = false;
            
            // 更新每个雨滴的位置
            for (let i = 0; i < raindrops.length; i++) {
                // 随机决定是否重置这个雨滴的位置
                if (Math.random() < 0.2) { // 20%的几率重置位置
                    const left = Math.random() * 100;
                    const top = Math.random() * -50; // 起始位置在屏幕上方
                    
                    raindrops[i] = {
                        ...raindrops[i],
                        left: left + 'vw',
                        top: top + 'vh'
                    };
                    
                    updated = true;
                }
            }
            
            // 如果有更新，则更新数据
            if (updated) {
                this.setData({ raindrops });
            }
        }, 300); // 每300毫秒执行一次心跳
    },
    
    // 新增方法：停止雨滴心跳机制
    stopRaindropHeartbeat() {
        if (this.raindropHeartbeat) {
            clearInterval(this.raindropHeartbeat);
            this.raindropHeartbeat = null;
            
            this.setData({
                'raindropPool.heartbeatActive': false
            });
        }
    },
    
    // 生成雪花效果
    generateSnowflakes() {
        // 初始化雪花池
        this.initSnowflakePool();
        
        this.setData({ 
            weatherEffect: 'snow'
        });
        
        // 启动心跳机制
        this.startSnowflakeHeartbeat();
    },
    
    // 新增方法：初始化雪花池
    initSnowflakePool() {
        // 停止现有心跳
        this.stopSnowflakeHeartbeat();
        
        // 设置最大雪花数
        const maxCount = 30;
        
        // 创建初始雪花池
        const snowflakes = [];
        
        for (let i = 0; i < maxCount; i++) {
            snowflakes.push(this.createSnowflake(i));
        }
        
        this.setData({ 
            snowflakes,
            'snowflakePool.activeCount': maxCount,
            'snowflakePool.maxCount': maxCount,
            'snowflakePool.poolReady': true
        });
    },
    
    // 新增方法：创建单个雪花
    createSnowflake(index) {
        // 随机雪花大小
        const size = (Math.random() * 8 + 4) + 'rpx';
        
        // 随机位置
        const left = Math.random() * 100;
        const top = Math.random() * -50; // 起始位置在屏幕上方
        
        // 随机速度 (雪花下落比雨滴慢)
        const duration = (Math.random() * 5 + 10) + 's';
        
        return {
            left: left + 'vw',
            top: top + 'vh',
            delay: '0s', // 不使用延迟，由心跳控制
            duration: duration,
            size: size,
            opacity: Math.random() * 0.3 + 0.7, // 随机透明度
            rotation: Math.random() * 360, // 随机旋转角度
            active: true, // 标记雪花是否活跃
            id: index // 为雪花添加唯一ID
        };
    },
    
    // 新增方法：启动雪花心跳机制
    startSnowflakeHeartbeat() {
        // 如果心跳已经激活，则不重复启动
        if (this.data.snowflakePool.heartbeatActive) {
            return;
        }
        
        // 设置心跳状态为激活
        this.setData({
            'snowflakePool.heartbeatActive': true
        });
        
        // 创建心跳间隔，控制雪花的重用
        this.snowflakeHeartbeat = setInterval(() => {
            // 检查是否应该继续心跳
            if (!this.data.snowflakePool.heartbeatActive || this.data.weatherEffect !== 'snow') {
                this.stopSnowflakeHeartbeat();
                return;
            }
            
            // 获取当前雪花数组的副本
            const snowflakes = [...this.data.snowflakes];
            let updated = false;
            
            // 更新每个雪花的位置
            for (let i = 0; i < snowflakes.length; i++) {
                // 随机决定是否重置这个雪花的位置
                if (Math.random() < 0.15) { // 15%的几率重置位置，比雨滴低一些因为雪花下落更慢
                    const left = Math.random() * 100;
                    const top = Math.random() * -50; // 起始位置在屏幕上方
                    const rotation = Math.random() * 360; // 随机旋转角度
                    
                    snowflakes[i] = {
                        ...snowflakes[i],
                        left: left + 'vw',
                        top: top + 'vh',
                        rotation: rotation
                    };
                    
                    updated = true;
                }
            }
            
            // 如果有更新，则更新数据
            if (updated) {
                this.setData({ snowflakes });
            }
        }, 500); // 每500毫秒执行一次心跳，比雨滴心跳慢一些
    },
    
    // 新增方法：停止雪花心跳机制
    stopSnowflakeHeartbeat() {
        if (this.snowflakeHeartbeat) {
            clearInterval(this.snowflakeHeartbeat);
            this.snowflakeHeartbeat = null;
            
            this.setData({
                'snowflakePool.heartbeatActive': false
            });
        }
    },
    
    // 生成晴天效果
    generateSunnyEffect() {
        const sunrayCount = 24; // 增加阳光射线数量，从12增加到24
        const sunrays = [];
        
        // 生成均匀分布的阳光射线，添加更多变化
        for (let i = 0; i < sunrayCount; i++) {
            const angle = (i * 360 / sunrayCount);
            
            // 添加光线长度变化
            const length = 160 + (i % 3) * 50; // 基础长度160rpx，每隔3条变化一次，增加50rpx
            
            // 添加光线宽度变化
            const width = 2 + (i % 4); // 基础宽度2rpx，每隔4条变化一次，最大达到5rpx
            
            // 添加光线亮度变化
            const opacity = 0.6 + (i % 3) * 0.15; // 基础亮度0.6，每隔3条变化一次，最大达到0.9
            
            // 添加光线动画延迟，使光线闪烁错开
            const animationDelay = (i % 5) * 0.5; // 每隔5条错开0.5秒
            
            sunrays.push({
                angle: angle,
                length: length + 'rpx',
                width: width + 'rpx',
                opacity: opacity,
                animationDelay: animationDelay + 's'
            });
        }
        
        // 添加辅助光晕数据
        const glowCount = 3; // 添加3层光晕
        const glows = [];
        
        for (let i = 0; i < glowCount; i++) {
            glows.push({
                size: (160 + i * 80) + 'rpx', // 从160rpx开始，每层增加80rpx
                opacity: 0.5 - (i * 0.15), // 从0.5开始，每层减少0.15透明度
                animationDelay: (i * 0.8) + 's', // 错开动画延迟
                animationDuration: (4 + i) + 's' // 动画时长从4秒开始递增
            });
        }
        
        // 计算斜光角度 - 新增
        // 使用当前时间来计算角度，使其随时间变化
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        
        // 根据时间计算角度，早上向东(45°)，中午向下(135°)，傍晚向西(225°)
        // 6点-18点的角度变化：45° -> 135° -> 225°
        let diagonalRayAngle = 45;
        
        if (hours >= 6 && hours <= 18) {
            // 将6点-18点映射到45°-225°
            const timeProgress = (hours - 6 + minutes / 60) / 12; // 0到1之间的进度
            diagonalRayAngle = 45 + timeProgress * 180;
        } else if (hours > 18) {
            // 晚上到凌晨保持在225°-45°之间
            const timeProgress = (hours - 18 + minutes / 60) / 12; // 0到1之间的进度
            diagonalRayAngle = 225 + timeProgress * 180;
        } else {
            // 凌晨到早上保持在225°-45°之间
            const timeProgress = (hours + minutes / 60) / 6; // 0到1之间的进度
            diagonalRayAngle = 225 + timeProgress * 180;
        }
        
        this.setData({ 
            sunrays,
            sunGlows: glows,
            diagonalRayAngle: diagonalRayAngle, // 新增斜光角度
            weatherEffect: 'sunny'
        });
        
        // 启动斜光角度更新定时器 - 每分钟更新一次角度
        if (this.diagonalRayTimer) {
            clearInterval(this.diagonalRayTimer);
        }
        
        this.diagonalRayTimer = setInterval(() => {
            // 只有在晴天效果激活时才更新
            if (this.data.weatherEffect === 'sunny') {
                const now = new Date();
                const hours = now.getHours();
                const minutes = now.getMinutes();
                
                let newAngle = 45;
                if (hours >= 6 && hours <= 18) {
                    const timeProgress = (hours - 6 + minutes / 60) / 12;
                    newAngle = 45 + timeProgress * 180;
                } else if (hours > 18) {
                    const timeProgress = (hours - 18 + minutes / 60) / 12;
                    newAngle = 225 + timeProgress * 180;
                } else {
                    const timeProgress = (hours + minutes / 60) / 6;
                    newAngle = 225 + timeProgress * 180;
                }
                
                this.setData({ diagonalRayAngle: newAngle });
            } else {
                // 如果不是晴天效果，则停止定时器
                clearInterval(this.diagonalRayTimer);
                this.diagonalRayTimer = null;
            }
        }, 60000); // 每分钟更新一次
    },
    
    // 生成多云效果
    generateCloudyEffect() {
        const cloudCount = 4; // 增加云朵数量，更好地填充扩大的区域
        const clouds = [];
        
        for (let i = 0; i < cloudCount; i++) {
            // 随机位置，适应更大的显示区域
            const left = (i * 25) + (Math.random() * 15); // 均匀分布云朵，覆盖整个宽度
            const top = (Math.random() * 30) + (i % 3) * 12; // 扩大垂直分布范围
            
            // 随机大小 - 适合扩大后的区域
            const scale = (Math.random() * 0.5 + 0.9); // 稍微增大云朵
            
            // 随机速度 (云朵移动缓慢且更均匀)
            const speedBase = 160 + (i * 15); // 基础速度随索引递增
            const duration = (Math.random() * 30 + speedBase) + 's'; // 保持速度变化较小
            
            // 随机透明度 - 更柔和
            const opacity = (Math.random() * 0.15 + 0.7); // 增加透明度
            
            // 随机延迟 - 确保不会同时开始移动
            const delay = (i * 15) + (Math.random() * 20) + 's';
            
            clouds.push({
                left: left + 'vw', // 随机水平位置
                top: top + 'vh', // 随机垂直位置
                delay: delay, // 错开的延迟时间
                scale: scale, // 随机大小
                duration: duration, // 随机移动速度
                opacity: opacity // 随机透明度
            });
        }
        
        // 使用setData时添加渐变淡入效果
        this.setData({ 
            clouds: [], // 先清空云朵
            weatherEffect: 'cloudy'
        }, () => {
            // 短暂延迟后添加云朵，实现平滑过渡
            setTimeout(() => {
                this.setData({ clouds });
            }, 100);
        });
    },
    
    // 生成阴天效果
    generateOvercastEffect() {
        const cloudCount = 4; // 增加云朵数量，更好地填充扩大的区域
        const overcastClouds = [];
        
        for (let i = 0; i < cloudCount; i++) {
            // 随机位置，适应更大的显示区域
            const left = (i * 25) + (Math.random() * 15); // 均匀分布云朵，覆盖整个宽度
            const top = (Math.random() * 30) + (i % 3) * 12; // 扩大垂直分布范围
            
            // 随机大小 - 适合扩大后的区域
            const scale = (Math.random() * 0.5 + 1.0); // 稍微增大云朵
            
            // 随机不透明度 (阴天云朵较暗)
            const opacity = (Math.random() * 0.25 + 0.6); // 增加透明度
            
            // 随机速度 (阴天云朵移动更缓慢且更均匀)
            const speedBase = 190 + (i * 20); // 基础速度随索引递增
            const duration = (Math.random() * 40 + speedBase) + 's'; // 保持速度变化较小
            
            // 随机延迟 - 确保不会同时开始移动
            const delay = (i * 20) + (Math.random() * 30) + 's';
            
            overcastClouds.push({
                left: left + 'vw', // 随机水平位置
                top: top + 'vh', // 随机垂直位置
                delay: delay, // 错开的延迟时间
                scale: scale, // 随机大小
                opacity: opacity, // 随机不透明度
                duration: duration // 随机移动速度
            });
        }
        
        // 使用setData时添加渐变淡入效果
        this.setData({ 
            overcastClouds: [], // 先清空云朵
            weatherEffect: 'overcast'
        }, () => {
            // 短暂延迟后添加云朵，实现平滑过渡
            setTimeout(() => {
                this.setData({ overcastClouds });
            }, 100);
        });
    },
    
    // 生成沙尘暴效果
    generateSandstormEffect() {
        const particleCount = 200; // 沙尘粒子数量
        const sandParticles = [];
        
        for (let i = 0; i < particleCount; i++) {
            // 随机粒子大小
            const size = (Math.random() * 3 + 1) + 'rpx';
            
            // 随机位置
            const left = Math.random() * 100;
            const top = Math.random() * 100;
            
            // 随机速度和方向
            const duration = (Math.random() * 3 + 2) + 's';
            const direction = Math.random() > 0.5 ? 'left' : 'right';
            
            // 随机不透明度
            const opacity = Math.random() * 0.6 + 0.4;
            
            sandParticles.push({
                left: left + 'vw',
                top: top + 'vh',
                size: size,
                duration: duration,
                direction: direction,
                delay: Math.random() * 5 + 's',
                opacity: opacity
            });
        }
        
        this.setData({
            sandParticles,
            weatherEffect: 'sandstorm'
        });
    },
    
    // 生成雾效果
    generateFogEffect() {
        const fogLayerCount = 6; // 雾层数量
        const fogParticles = [];
        
        for (let i = 0; i < fogLayerCount; i++) {
            // 随机雾层高度和位置
            const height = (Math.random() * 20 + 15) + 'vh';
            const top = (i * 15) + (Math.random() * 5) + 'vh';
            
            // 随机移动速度和方向
            const duration = (Math.random() * 60 + 60) + 's';
            const direction = Math.random() > 0.5 ? 'left' : 'right';
            
            // 随机不透明度
            const opacity = Math.random() * 0.3 + 0.2;
            
            fogParticles.push({
                top: top,
                height: height,
                duration: duration,
                direction: direction,
                delay: Math.random() * 10 + 's',
                opacity: opacity
            });
        }
        
        this.setData({
            fogParticles,
            weatherEffect: 'fog'
        });
    },
    
    // 生成霾效果
    generateHazeEffect() {
        const hazeLayerCount = 5; // 霾层数量
        const hazeParticles = [];
        
        for (let i = 0; i < hazeLayerCount; i++) {
            // 随机霾层高度和位置
            const height = (Math.random() * 25 + 15) + 'vh';
            const top = (i * 18) + (Math.random() * 5) + 'vh';
            
            // 随机移动速度
            const duration = (Math.random() * 80 + 100) + 's';
            
            // 随机不透明度和颜色
            const opacity = Math.random() * 0.2 + 0.3;
            const yellowness = Math.floor(Math.random() * 20 + 30); // 黄色程度 (30-50)
            
            hazeParticles.push({
                top: top,
                height: height,
                duration: duration,
                delay: Math.random() * 10 + 's',
                opacity: opacity,
                yellowness: yellowness
            });
        }
        
        this.setData({
            hazeParticles,
            weatherEffect: 'haze'
        });
    },
    
    // 生成打雷效果
    generateThunderEffect() {
        // 使用雨滴池系统，但设置为大雨强度
        this.initRaindropPool('heavy');
        
        // 生成闪电
        const lightnings = [];
        
        // 生成一个主闪电
        const left = Math.random() * 60 + 20; // 20-80% 范围内，使闪电更居中
        
        // 随机闪电形状参数
        const width = (Math.random() * 10 + 6) + 'rpx'; // 6-16rpx 宽度
        const height = (Math.random() * 30 + 90) + 'vh'; // 90-120vh 高度，确保闪电足够长
        const branches = 6; // 固定使用6个分支，最大化分支数量
        
        // 闪电时间间隔
        const interval = 12; // 固定12秒间隔，与CSS动画时间匹配
        
        // 闪电亮度
        const brightness = 1.0; // 最大亮度
        
        lightnings.push({
            left: left + 'vw',
            width: width,
            height: height,
            branches: branches,
            interval: interval + 's',
            brightness: brightness
        });
        
        this.setData({
            lightnings,
            weatherEffect: 'thunder'
        });
        
        // 启动心跳机制
        this.startRaindropHeartbeat();
    },
    
    // 设置天气特效
    setWeatherEffect(weatherType) {
        // 如果当前已经是雨天效果且用户强制要求保持雨天效果，则保持不变
        let finalWeatherType = weatherType; // 获取天气，修改天气效果。请查看 rain 大雨 , lightRain 小雨, snow 雪, sunny 晴, cloudy 多云, overcast 阴天, sandstorm 沙尘暴, fog 雾, haze 霾, thunder 雷电
        
        // 停止当前可能正在运行的心跳机制，如果切换到其他天气类型
        if (finalWeatherType !== 'rain' && finalWeatherType !== 'lightRain' && finalWeatherType !== 'thunder') {
            this.stopRaindropHeartbeat();
        }
        
        if (finalWeatherType !== 'snow') {
            this.stopSnowflakeHeartbeat();
        }
        
        // 根据天气类型生成对应特效
        switch (finalWeatherType) {
            case 'rain':
                this.generateRaindrops();
                break;
            case 'lightRain':
                this.generateLightRaindrops();
                break;
            case 'snow':
                this.generateSnowflakes();
                break;
            case 'sunny':
                this.generateSunnyEffect();
                break;
            case 'cloudy':
                this.generateCloudyEffect();
                break;
            case 'overcast':
                this.generateOvercastEffect();
                break;
            case 'sandstorm':
                this.generateSandstormEffect();
                break;
            case 'fog':
                this.generateFogEffect();
                break;
            case 'haze':
                this.generateHazeEffect();
                break;
            case 'thunder':
                this.generateThunderEffect();
                break;
            default:
                // 默认晴天特效
                this.generateSunnyEffect();
                break;
        }
    },
    
    // 新增方法：强制显示雨效果
    forceRainEffect() {
        console.log("强制显示大雨效果");
        this.setData({
            weatherEffect: 'rain',
            snowflakes: [],
            sunrays: [],
            clouds: [],
            overcastClouds: [],
            stars: [],
            sandParticles: [],
            fogParticles: [],
            hazeParticles: [],
            lightnings: []
        });
        // 生成雨滴并设置天气效果类型
        this.generateRaindrops();
    },
    
    // 新增方法：确保雨效果显示
    ensureRainEffect() {
        // 如果当前没有显示雨效果，则强制显示
        if (this.data.weatherEffect !== 'rain') {
            console.log('强制启用大雨效果 - 当前效果不是大雨');
            this.forceRainEffect();
        } 
        // 如果当前已经是大雨效果，但心跳机制未激活，则重新启动
        else if (!this.data.raindropPool.heartbeatActive) {
            console.log('强制启用大雨效果 - 心跳机制未激活');
            this.startRaindropHeartbeat();
        }
        else {
            console.log('已经启用大雨效果，雨滴心跳机制已激活');
        }
    },
    
    // 新增方法：强制显示小雨效果
    forceLightRainEffect() {
        console.log("强制显示小雨效果");
        this.setData({
            weatherEffect: 'lightRain',
            snowflakes: [],
            sunrays: [],
            clouds: [],
            overcastClouds: [],
            stars: [],
            sandParticles: [],
            fogParticles: [],
            hazeParticles: [],
            lightnings: []
        });
        // 生成小雨滴并设置天气效果类型
        this.generateLightRaindrops();
    },
    
    // 新增方法：确保小雨效果显示
    ensureLightRainEffect() {
        // 如果当前没有显示小雨效果，则强制显示
        if (this.data.weatherEffect !== 'lightRain') {
            console.log('强制启用小雨效果 - 当前效果不是小雨');
            this.forceLightRainEffect();
        } 
        // 如果当前已经是小雨效果，但心跳机制未激活，则重新启动
        else if (!this.data.raindropPool.heartbeatActive) {
            console.log('强制启用小雨效果 - 心跳机制未激活');
            this.startRaindropHeartbeat();
        }
        else {
            console.log('已经启用小雨效果，雨滴心跳机制已激活');
        }
    },
    
    // 新增方法：强制显示雪效果
    forceSnowEffect() {
        console.log("强制显示雪效果");
        this.setData({
            weatherEffect: 'snow',
            raindrops: [],
            sunrays: [],
            clouds: [],
            overcastClouds: [],
            stars: [],
            sandParticles: [],
            fogParticles: [],
            hazeParticles: [],
            lightnings: []
        });
        // 生成雪花并设置天气效果类型
        this.generateSnowflakes();
    },

    // 新增方法：确保雪效果显示
    ensureSnowEffect() {
        // 如果当前没有显示雪效果，则强制显示
        if (this.data.weatherEffect !== 'snow') {
            console.log('强制启用雪效果 - 当前效果不是雪');
            this.forceSnowEffect();
        } 
        // 如果当前已经是雪效果，但心跳机制未激活，则重新启动
        else if (!this.data.snowflakePool.heartbeatActive) {
            console.log('强制启用雪效果 - 心跳机制未激活');
            this.startSnowflakeHeartbeat();
        }
        else {
            console.log('已经启用雪效果，雪花心跳机制已激活');
        }
    },

    // 新增方法：强制显示晴天效果
    forceSunnyEffect() {
        // 生成晴天效果并设置天气效果类型
        this.generateSunnyEffect();
    },

    // 新增方法：确保晴天效果显示
    ensureSunnyEffect() {
        // 如果当前没有显示晴天效果，则强制显示
        if (this.data.weatherEffect !== 'sunny') {
            console.log('强制启用晴天效果');
            this.forceSunnyEffect();
        } else {
            console.log('已经启用晴天效果');
        }
    },

    // 新增方法：强制显示多云效果
    forceCloudyEffect() {
        // 生成多云效果并设置天气效果类型
        this.generateCloudyEffect();
    },

    // 新增方法：确保多云效果显示
    ensureCloudyEffect() {
        // 如果当前没有显示多云效果，则强制显示
        if (this.data.weatherEffect !== 'cloudy') {
            console.log('强制启用多云效果');
            this.forceCloudyEffect();
        } else {
            console.log('已经启用多云效果');
        }
    },

    // 新增方法：强制显示阴天效果
    forceOvercastEffect() {
        // 生成阴天效果并设置天气效果类型
        this.generateOvercastEffect();
    },

    // 新增方法：确保阴天效果显示
    ensureOvercastEffect() {
        // 如果当前没有显示阴天效果，则强制显示
        if (this.data.weatherEffect !== 'overcast') {
            console.log('强制启用阴天效果');
            this.forceOvercastEffect();
        } else {
            console.log('已经启用阴天效果');
        }
    },

    // 新增方法：强制显示沙尘暴效果
    forceSandstormEffect() {
        // 生成沙尘暴效果并设置天气效果类型
        this.generateSandstormEffect();
    },

    // 新增方法：确保沙尘暴效果显示
    ensureSandstormEffect() {
        // 如果当前没有显示沙尘暴效果，则强制显示
        if (this.data.weatherEffect !== 'sandstorm') {
            console.log('强制启用沙尘暴效果');
            this.forceSandstormEffect();
        } else {
            console.log('已经启用沙尘暴效果');
        }
    },

    // 新增方法：强制显示雾效果
    forceFogEffect() {
        // 生成雾效果并设置天气效果类型
        this.generateFogEffect();
    },

    // 新增方法：确保雾效果显示
    ensureFogEffect() {
        // 如果当前没有显示雾效果，则强制显示
        if (this.data.weatherEffect !== 'fog') {
            console.log('强制启用雾效果');
            this.forceFogEffect();
        } else {
            console.log('已经启用雾效果');
        }
    },

    // 新增方法：强制显示霾效果
    forceHazeEffect() {
        // 生成霾效果并设置天气效果类型
        this.generateHazeEffect();
    },

    // 新增方法：确保霾效果显示
    ensureHazeEffect() {
        // 如果当前没有显示霾效果，则强制显示
        if (this.data.weatherEffect !== 'haze') {
            console.log('强制启用霾效果');
            this.forceHazeEffect();
        } else {
            console.log('已经启用霾效果');
        }
    },

    // 新增方法：强制显示打雷效果
    forceThunderEffect() {
        console.log("强制显示打雷效果");
        this.setData({
            weatherEffect: 'thunder',
            snowflakes: [],
            sunrays: [],
            clouds: [],
            overcastClouds: [],
            stars: [],
            sandParticles: [],
            fogParticles: [],
            hazeParticles: []
        });
        // 生成打雷效果并设置天气效果类型
        this.generateThunderEffect();
    },

    // 新增方法：确保打雷效果显示
    ensureThunderEffect() {
        // 如果当前没有显示打雷效果，则强制显示
        if (this.data.weatherEffect !== 'thunder') {
            console.log('强制启用打雷效果');
            this.forceThunderEffect();
        } else {
            console.log('已经启用打雷效果');
            
            // 检查雨滴心跳是否激活
            if (!this.data.raindropPool.heartbeatActive) {
                console.log('雨滴心跳未激活，重新启动心跳');
                this.startRaindropHeartbeat();
            }
            
            // 每隔一段时间刷新闪电效果，使闪电看起来更加动态
            setTimeout(() => {
                // 保持雨滴，但重新生成闪电
                const lightningCount = 7;
                const lightnings = [];
                
                for (let i = 0; i < lightningCount; i++) {
                    const left = Math.random() * 80 + 10;
                    const width = (Math.random() * 8 + 4) + 'rpx';
                    const height = (Math.random() * 50 + 70) + 'vh';
                    const branches = Math.floor(Math.random() * 3) + 4;
                    const interval = Math.random() * 5 + 3;
                    const brightness = Math.random() * 0.2 + 0.8;
                    
                    lightnings.push({
                        left: left + 'vw',
                        width: width,
                        height: height,
                        branches: branches,
                        interval: interval + 's',
                        brightness: brightness
                    });
                }
                
                this.setData({ lightnings });
                
                // 继续确保打雷效果显示
                setTimeout(() => {
                    this.ensureThunderEffect();
                }, 10000); // 每10秒刷新一次闪电效果
            }, 5000); // 5秒后刷新第一次
        }
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
                        title: '无网络连接',
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
            
            // 保存当前的天气效果状态
            const currentWeatherEffect = this.data.weatherEffect;
            
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

            // 验证城市搜索响应数据
            if (!citySearch.data || !citySearch.data.location || !citySearch.data.location[0]) {
                throw new Error('城市搜索API返回数据无效');
            }

            // 获取实时天气
            const weatherNow = await instance.get('/v7/weather/now', {
                location: longitude + "," + latitude,
                key: "2d57f1cc456d421c8bbdd925db34555a"
            });
            
            // 打印完整的weatherNow数据，方便查看实时天气数据结构
            console.log("实时天气数据 weatherNow:", JSON.stringify(weatherNow.data, null, 2));
            
            // 验证实时天气响应数据
            if (!weatherNow.data || !weatherNow.data.now) {
                throw new Error('实时天气API返回数据无效');
            }

            // 获取空气质量
            const airQuality = await instance.get('/v7/air/now', {
                location: longitude + "," + latitude,
                key: "2d57f1cc456d421c8bbdd925db34555a"
            });
            
            // 验证空气质量响应数据
            if (!airQuality.data || !airQuality.data.now) {
                throw new Error('空气质量API返回数据无效');
            }

            // 获取3天的天气预报
            const weather3Day = await instance.get('/v7/weather/3d', {
                location: longitude + "," + latitude,
                key: "2d57f1cc456d421c8bbdd925db34555a"
            });
            
            // 验证3天天气预报响应数据
            if (!weather3Day.data || !weather3Day.data.daily || !weather3Day.data.daily.length) {
                throw new Error('3天天气预报API返回数据无效');
            }
            
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
            
            // 验证24小时天气预报响应数据
            if (!hour24.data || !hour24.data.hourly || !hour24.data.hourly.length) {
                throw new Error('24小时天气预报API返回数据无效');
            }
            
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
            
            // 验证7天天气预报响应数据
            if (!weather7Day.data || !weather7Day.data.daily || !weather7Day.data.daily.length) {
                throw new Error('7天天气预报API返回数据无效');
            }

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
            
            // 验证生活指数响应数据
            if (!lifeIndex.data || !lifeIndex.data.daily || !lifeIndex.data.daily.length) {
                throw new Error('生活指数API返回数据无效');
            }
            
            // 获取当前时间作为更新时间
            const now = new Date();
            const lastUpdateTime = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            
            // 检查天气类型并获取对应的天气效果类型
            const weatherText = weatherNow.data.now.text;
            const weatherType = this.checkWeatherType(weatherText);
            console.log("当前天气文本:", weatherText, "对应天气效果:", weatherType);
            
            // 如果当前已经是雨天效果且用户强制要求保持雨天效果，则保持不变
            let finalWeatherType = weatherType; // 获取天气，修改天气效果。请查看 rain 大雨 , lightRain 小雨, snow 雪, sunny 晴, cloudy 多云, overcast 阴天, sandstorm 沙尘暴, fog 雾, haze 霾, thunder 雷电
            if (currentWeatherEffect === 'rain' && this.data.forceRainEffect) {
                finalWeatherType = 'rain';
            } 
            // 如果当前已经是小雨效果且用户强制要求保持小雨效果，则保持不变
            else if (currentWeatherEffect === 'lightRain' && this.data.forceLightRainEffect) {
                finalWeatherType = 'lightRain';
            }
            // 如果用户强制要求显示雨效果，则显示雨效果
            else if (this.data.forceRainEffect) {
                finalWeatherType = 'rain';
            }
            // 如果用户强制要求显示小雨效果，则显示小雨效果
            else if (this.data.forceLightRainEffect) {
                finalWeatherType = 'lightRain';
            }
            // 如果用户强制要求显示雪效果，则显示雪效果
            else if (this.data.forceSnowEffect) {
                finalWeatherType = 'snow';
            }
            // 如果用户强制要求显示晴天效果，则显示晴天效果
            else if (this.data.forceSunnyEffect) {
                finalWeatherType = 'sunny';
            }
            // 如果用户强制要求显示多云效果，则显示多云效果
            else if (this.data.forceCloudyEffect) {
                finalWeatherType = 'cloudy';
            }
            // 如果用户强制要求显示阴天效果，则显示阴天效果
            else if (this.data.forceOvercastEffect) {
                finalWeatherType = 'overcast';
            }
            // 如果用户强制要求显示沙尘暴效果，则显示沙尘暴效果
            else if (this.data.forceSandstormEffect) {
                finalWeatherType = 'sandstorm';
            }
            // 如果用户强制要求显示雾效果，则显示雾效果
            else if (this.data.forceFogEffect) {
                finalWeatherType = 'fog';
            }
            // 如果用户强制要求显示霾效果，则显示霾效果
            else if (this.data.forceHazeEffect) {
                finalWeatherType = 'haze';
            }
            // 如果用户强制要求显示打雷效果，则显示打雷效果
            else if (this.data.forceThunderEffect) {
                finalWeatherType = 'thunder';
            }
            
            // 根据天气类型设置相应的特效
            this.setWeatherEffect(finalWeatherType);
            
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
                isOffline: false  // 明确设置为非离线模式
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
            
            // 添加更详细的错误日志
            console.error("请求网络天气数据失败详情：", {
                errorName: error.name,
                errorMessage: error.message,
                errorStack: error.stack,
                networkType: await this.checkNetworkStatus()
            });
            
            // 请求失败时，尝试读取缓存数据
            const success = this.loadCachedWeatherData();
            if (success) {
                // 设置离线状态标志
                this.setData({ isOffline: true });
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
    
    // 页面卸载时清理资源
    onUnload() {
        // 停止雨滴心跳
        this.stopRaindropHeartbeat();
        // 停止雪花心跳
        this.stopSnowflakeHeartbeat();
        // 清理斜光角度更新定时器
        if (this.diagonalRayTimer) {
            clearInterval(this.diagonalRayTimer);
            this.diagonalRayTimer = null;
        }
    }
})