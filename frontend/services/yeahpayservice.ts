import API from '../src/api';

export const processYeahPayCardPayment = async (amount: number, deviceSn: string, salt: string) => {
    console.log('🔵 processYeahPayCardPayment CALLED');
    console.log('  - amount:', amount);
    console.log('  - deviceSn:', deviceSn);
    console.log('  - salt:', salt ? 'Yes' : 'No');
    
    try {
        console.log('📡 Calling /yeahpay/card-payment...');
        const response = await API.post('/yeahpay/card-payment', {
            amount: amount,
            deviceSn: deviceSn,
            salt: salt
        });
        
        console.log('✅ YeahPay response:', response.data);
        
        return {
            success: response.data.success === true,
            code: response.data.code,
            msg: response.data.msg,
            data: response.data.data
        };
    } catch (error: any) {
        console.log('❌ YeahPay card error:', error.message);
        console.log('❌ Error response:', error.response?.data);
        return {
            success: false,
            code: -1,
            msg: error.response?.data?.msg || error.message
        };
    }
};

export const processYeahPayPayNowPayment = async (amount: number, deviceSn: string, salt: string) => {
    console.log('🔵 processYeahPayPayNowPayment CALLED');
    try {
        const response = await API.post('/yeahpay/paynow-payment', {
            amount: amount,
            deviceSn: deviceSn,
            salt: salt
        });
        
        console.log('✅ PayNow API response:', response.data);
        
        return {
            success: response.data.success === true,
            code: response.data.code,
            msg: response.data.msg,
            data: response.data.data
        };
    } catch (error: any) {
        console.log('❌ YeahPay PayNow error:', error.message);
        return {
            success: false,
            code: -1,
            msg: error.response?.data?.msg || error.message
        };
    }
};