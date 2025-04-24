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
        selectedCity: {}
    },
    // 地理定位
    // 地理定位
    async requestLocation() {
        // 使用 wx.getSetting()获取用户所有的授权信息，查询是否已经授权获取地理位置信息。
        // authSetting：只包含了小程序向用户请求的所有的权限。
        // 属性返回: true拒绝授权后访问
        // 属性返回: false没有请求授权过
        // 访问属性返回: undefined
        const { authSetting } = await wx.getSetting()
        // scope.userLocation:false 用户是否授权获取了地理位置信息
        // 如果小程序没有向用户发起过授权请求，authsetting中没有 scope.userlocation 属性
        // 如果用户点击了允许授权，返回值就是 true，如果用户点击了拒绝授权，返回值就是 false
        // 如果用户拒绝了授权
        if (authSetting["scope.userLocation"] === false) {
            wx.showModal({
                title: '授权提示',
                content: '需要获取地理位智信息，请确认授权',
                success: async (res) => { // 这里必须使用异步
                    // 如果用户点击了确定，说明用户同意授权，需要打开微信宫户端小程序授权页面
                    if (res.confirm) {
                        const { authSetting } = await wx.openSetting() // 必须使用await，不然接收不到
                        console.log(authSetting)
                        // 如果用户进入设置页面，没有更新授权信息，需要给用户提示授权失败
                        if (!authSetting['scope.userLocation']) {
                            wx.showToast({
                                title: '您拒绝授权获取地理位置',
                                icon: 'error',    // 图标类型：success / loading / none / error
                                duration: 2000       // 显示时间（毫秒）
                            })
                        } else {
                            try {
                                // 获取当前的地理位置(精度、纬度、高度等)，如果拒绝会报错，再次调用授权不会再有弹框
                                // 重新获取定位
                                this.requestNetWeatherData()
                            } catch (error) {
                                // 拒绝授权，报错，进行弹框提示
                                wx.showToast({
                                    title: '您拒绝授权获取地理位置',
                                    icon: 'error',    // 图标类型：success / loading / none / error
                                    duration: 2000       // 显示时间（毫秒）
                                })
                            }
                        }
                    } else if (res.cancel) { // 用户再次拒绝授权
                        wx.showToast({
                            title: '您拒绝授权获取地理位置',
                            icon: 'error',    // 图标类型：success / loading / none / error
                            duration: 2000       // 显示时间（毫秒）
                        })
                    }
                }
            })
        } else {
            try {
                // 重新获取定位
                this.requestNetWeatherData()
            } catch (error) {
                // 拒绝授权，报错，进行弹框提示
                wx.showToast({
                    title: '您拒绝授权获取地理位置',
                })
            }
        }
    },
    // 获取网络天气图片
    async requestNetWeatherData() {
        try {
            // 检查是否已有有效的纬度和经度
            let latitude = this.data.latitude;
            let longitude = this.data.longitude;

            // 如果纬度或经度为空，则需要获取地理位置
            if (latitude === '' || longitude === '') {

                // 获取当前的地理位置
                const location = await wx.getLocation();

                console.log(location.authSetting)
                // 获取新的纬度和经度
                latitude = location.latitude.toFixed(2);
                longitude = location.longitude.toFixed(2);
                console.log("获取新的经度：" + longitude + "，纬度：" + latitude);
            } else {
                console.log("使用存储的经纬度：" + longitude + "，纬度：" + latitude);
            }

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
            // 更新数据
            this.setData({
                cityData: citySearch.data.location[0],
                latitude: latitude,  // 纬度
                longitude: longitude,  // 经度
                shishitianqi: weatherNow.data.now,  // 实时天气
                zhiliang: airQuality.data.now.category,  // 空气质量
                daily3Weather: daily3Weather,  // 每日天气预报-3天
                hourlyWeather: hourlyWeather, // 逐小时天气预报
                daily7Weather: daily7Weather, // 每日天气预报-7天
                lifeIndices: lifeIndex.data.daily  // 生活指数
            });
            // 等待图表绘制完成
            await this.zhexiantu();  // 等待绘制图表
        } catch (error) {
            console.error("请求失败：", error);
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
        const ctx = wx.createCanvasContext('weatherCanvas');  // 获取canvas绘图上下文
        const { daily7Weather } = this.data; // 读取数据
        if (!daily7Weather.length) return;

        // 获取最高温度和最低温度
        const data1 = daily7Weather.map(day => parseInt(day.tempMax));
        const data2 = daily7Weather.map(day => parseInt(day.tempMin));
        const maxTemp = Math.max(...data1);  // 计算最大温度
        const minTemp = Math.min(...data2);  // 计算最小温度

        const query = wx.createSelectorQuery();
        query.select('.scroll-x').boundingClientRect(rect => {
            const chartWidth = rect.width;  // 获取scroll-view的宽度
            const chartHeight = 120; // 图表高度
            const margin = 25;       // 边距

            // 计算 X 轴每个点的间隔
            const stepX = (chartWidth - 2 * margin) / (data1.length - 1);

            // 绘制折线方法
            const drawLine = (data, color) => {
                ctx.beginPath();
                ctx.moveTo(margin, chartHeight - margin - ((data[0] - minTemp) / (maxTemp - minTemp)) * (chartHeight - 2 * margin));
                for (let i = 1; i < data.length; i++) {
                    let x = margin + (i * stepX);
                    let y = chartHeight - margin - ((data[i] - minTemp) / (maxTemp - minTemp)) * (chartHeight - 2 * margin);
                    ctx.lineTo(x, y);
                }
                ctx.setStrokeStyle(color);
                ctx.setLineWidth(2);
                ctx.stroke();
            };

            // 绘制最高温度折线
            drawLine(data1, '#FF4500');
            // 绘制最低温度折线
            drawLine(data2, '#1E90FF');

            // 绘制点和文本
            for (let i = 0; i < data1.length; i++) {
                let x = margin + (i * stepX);
                let y1 = chartHeight - margin - ((data1[i] - minTemp) / (maxTemp - minTemp)) * (chartHeight - 2 * margin);
                let y2 = chartHeight - margin - ((data2[i] - minTemp) / (maxTemp - minTemp)) * (chartHeight - 2 * margin);

                // 最高温点
                ctx.beginPath();
                ctx.arc(x, y1, 4, 0, 2 * Math.PI);
                ctx.setFillStyle('#FF4500');
                ctx.fill();
                ctx.setFillStyle('#FF4500');
                ctx.setFontSize(12);
                ctx.fillText(data1[i] + '°', x - 10, y1 - 10);

                // 最低温点
                ctx.beginPath();
                ctx.arc(x, y2, 4, 0, 2 * Math.PI);
                ctx.setFillStyle('#1E90FF');
                ctx.fill();
                ctx.setFillStyle('#1E90FF');
                ctx.setFontSize(12);
                ctx.fillText(data2[i] + '°', x - 10, y2 + 15);

                // X 轴星期标签
                ctx.setFillStyle('#000');
            }
            ctx.draw();
        }).exec();
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
    onLoad: function () {
        this.requestLocation()
    },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady: function () {
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
            this.setData({
                selectedCity: selectedCity,  // 存储整个对象
                latitude: selectedCity.lat,  // 赋值纬度
                longitude: selectedCity.lon  // 赋值经度
            }, () => {
                // 重新获取位置
                this.requestLocation()
                console.log('执行，重新获取位置')
            });
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
        this.requestNetWeatherData();
        // 调用 wx.stopPullDownRefresh()可以停止当前页面的下拉刷新。
        // 在下拉刷新以后，loading 效果有可能不会回弹回去
        wx.stopPullDownRefresh()
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
    // 跳转到贪吃蛇小游戏
    navigateToSnakeGame() {
        wx.navigateTo({
            url: '/pages/snake/snake',
        })
    }
})