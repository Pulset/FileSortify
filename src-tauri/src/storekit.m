#import <Foundation/Foundation.h>
#import <StoreKit/StoreKit.h>
#import "storekit.h"

@interface StoreKitManager : NSObject <SKProductsRequestDelegate, SKPaymentTransactionObserver>

@property (nonatomic, strong) NSArray<SKProduct *> *products;
@property (nonatomic, strong) SKProductsRequest *productsRequest;

+ (instancetype)sharedManager;
- (BOOL)initializeStoreKit;
- (BOOL)requestProductsWithIdentifiers:(NSArray<NSString *> *)productIdentifiers;
- (BOOL)purchaseProduct:(NSString *)productIdentifier;
- (BOOL)restorePurchases;
- (NSString *)getReceiptData;
- (BOOL)finishTransaction:(NSString *)transactionIdentifier;

@end

@implementation StoreKitManager

+ (instancetype)sharedManager {
    static StoreKitManager *sharedManager = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedManager = [[StoreKitManager alloc] init];
    });
    return sharedManager;
}

- (BOOL)initializeStoreKit {
    if ([SKPaymentQueue canMakePayments]) {
        [[SKPaymentQueue defaultQueue] addTransactionObserver:self];
        return YES;
    }
    return NO;
}

- (BOOL)requestProductsWithIdentifiers:(NSArray<NSString *> *)productIdentifiers {
    if (productIdentifiers.count == 0) {
        return NO;
    }
    
    NSSet<NSString *> *productIdentifiersSet = [NSSet setWithArray:productIdentifiers];
    self.productsRequest = [[SKProductsRequest alloc] initWithProductIdentifiers:productIdentifiersSet];
    self.productsRequest.delegate = self;
    [self.productsRequest start];
    
    return YES;
}

- (BOOL)purchaseProduct:(NSString *)productIdentifier {
    SKProduct *product = nil;
    for (SKProduct *p in self.products) {
        if ([p.productIdentifier isEqualToString:productIdentifier]) {
            product = p;
            break;
        }
    }
    
    if (!product) {
        return NO;
    }
    
    SKPayment *payment = [SKPayment paymentWithProduct:product];
    [[SKPaymentQueue defaultQueue] addPayment:payment];
    
    return YES;
}

- (BOOL)restorePurchases {
    [[SKPaymentQueue defaultQueue] restoreCompletedTransactions];
    return YES;
}

- (NSString *)getReceiptData {
    NSURL *receiptURL = [[NSBundle mainBundle] appStoreReceiptURL];
    NSData *receiptData = [NSData dataWithContentsOfURL:receiptURL];
    
    if (receiptData) {
        NSString *receiptString = [receiptData base64EncodedStringWithOptions:0];
        return receiptString;
    }
    
    return nil;
}

- (BOOL)finishTransaction:(NSString *)transactionIdentifier {
    NSArray<SKPaymentTransaction *> *transactions = [[SKPaymentQueue defaultQueue] transactions];
    
    for (SKPaymentTransaction *transaction in transactions) {
        if ([transaction.transactionIdentifier isEqualToString:transactionIdentifier]) {
            [[SKPaymentQueue defaultQueue] finishTransaction:transaction];
            return YES;
        }
    }
    
    return NO;
}

#pragma mark - SKProductsRequestDelegate

- (void)productsRequest:(SKProductsRequest *)request didReceiveResponse:(SKProductsResponse *)response {
    self.products = response.products;
    
    NSMutableArray *productsArray = [NSMutableArray array];
    for (SKProduct *product in response.products) {
        NSNumberFormatter *formatter = [[NSNumberFormatter alloc] init];
        formatter.numberStyle = NSNumberFormatterCurrencyStyle;
        formatter.locale = product.priceLocale;
        
        NSDictionary *productDict = @{
            @"productIdentifier": product.productIdentifier,
            @"localizedTitle": product.localizedTitle,
            @"localizedDescription": product.localizedDescription,
            @"price": [product.price stringValue],
            @"priceLocale": [product.priceLocale localeIdentifier],
            @"formattedPrice": [formatter stringFromNumber:product.price]
        };
        [productsArray addObject:productDict];
    }
    
    NSError *error;
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:productsArray options:0 error:&error];
    if (jsonData && !error) {
        NSString *jsonString = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
        on_products_received([jsonString UTF8String]);
    }
}

- (void)request:(SKRequest *)request didFailWithError:(NSError *)error {
    NSString *errorMessage = [NSString stringWithFormat:@"Products request failed: %@", error.localizedDescription];
    on_purchase_failed([errorMessage UTF8String]);
}

#pragma mark - SKPaymentTransactionObserver

- (void)paymentQueue:(SKPaymentQueue *)queue updatedTransactions:(NSArray<SKPaymentTransaction *> *)transactions {
    for (SKPaymentTransaction *transaction in transactions) {
        switch (transaction.transactionState) {
            case SKPaymentTransactionStatePurchased:
                [self completeTransaction:transaction];
                break;
            case SKPaymentTransactionStateFailed:
                [self failedTransaction:transaction];
                break;
            case SKPaymentTransactionStateRestored:
                [self restoreTransaction:transaction];
                break;
            case SKPaymentTransactionStateDeferred:
                // 处理延迟状态
                break;
            case SKPaymentTransactionStatePurchasing:
                // 处理购买中状态
                break;
        }
    }
}

- (void)completeTransaction:(SKPaymentTransaction *)transaction {
    NSDictionary *transactionDict = @{
        @"transactionIdentifier": transaction.transactionIdentifier ?: @"",
        @"productIdentifier": transaction.payment.productIdentifier,
        @"transactionDate": @([transaction.transactionDate timeIntervalSince1970]),
        @"originalTransactionIdentifier": transaction.originalTransaction.transactionIdentifier ?: @""
    };
    
    NSError *error;
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:transactionDict options:0 error:&error];
    if (jsonData && !error) {
        NSString *jsonString = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
        on_purchase_completed([jsonString UTF8String]);
    }
    
    [[SKPaymentQueue defaultQueue] finishTransaction:transaction];
}

- (void)restoreTransaction:(SKPaymentTransaction *)transaction {
    [self completeTransaction:transaction];
}

- (void)failedTransaction:(SKPaymentTransaction *)transaction {
    NSString *errorMessage = [NSString stringWithFormat:@"Transaction failed: %@", 
                             transaction.error.localizedDescription];
    on_purchase_failed([errorMessage UTF8String]);
    
    [[SKPaymentQueue defaultQueue] finishTransaction:transaction];
}

- (void)paymentQueueRestoreCompletedTransactionsFinished:(SKPaymentQueue *)queue {
    NSMutableArray *transactionsArray = [NSMutableArray array];
    
    for (SKPaymentTransaction *transaction in queue.transactions) {
        if (transaction.transactionState == SKPaymentTransactionStateRestored) {
            NSDictionary *transactionDict = @{
                @"transactionIdentifier": transaction.transactionIdentifier ?: @"",
                @"productIdentifier": transaction.payment.productIdentifier,
                @"transactionDate": @([transaction.transactionDate timeIntervalSince1970]),
                @"originalTransactionIdentifier": transaction.originalTransaction.transactionIdentifier ?: @""
            };
            [transactionsArray addObject:transactionDict];
        }
    }
    
    NSError *error;
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:transactionsArray options:0 error:&error];
    if (jsonData && !error) {
        NSString *jsonString = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
        on_restore_completed([jsonString UTF8String]);
    }
}

- (void)paymentQueue:(SKPaymentQueue *)queue restoreCompletedTransactionsFailedWithError:(NSError *)error {
    NSString *errorMessage = [NSString stringWithFormat:@"Restore failed: %@", error.localizedDescription];
    on_purchase_failed([errorMessage UTF8String]);
}

@end

// C接口实现
bool init_store_kit(void) {
    return [[StoreKitManager sharedManager] initializeStoreKit];
}

bool request_products(const char* product_ids_json) {
    if (!product_ids_json) return false;
    
    NSString *jsonString = [NSString stringWithUTF8String:product_ids_json];
    NSError *error;
    NSArray *productIds = [NSJSONSerialization JSONObjectWithData:[jsonString dataUsingEncoding:NSUTF8StringEncoding]
                                                          options:0
                                                            error:&error];
    
    if (error || ![productIds isKindOfClass:[NSArray class]]) {
        return false;
    }
    
    return [[StoreKitManager sharedManager] requestProductsWithIdentifiers:productIds];
}

bool purchase_product(const char* product_id) {
    if (!product_id) return false;
    
    NSString *productIdentifier = [NSString stringWithUTF8String:product_id];
    return [[StoreKitManager sharedManager] purchaseProduct:productIdentifier];
}

bool restore_purchases(void) {
    return [[StoreKitManager sharedManager] restorePurchases];
}

const char* get_receipt_data(void) {
    NSString *receiptData = [[StoreKitManager sharedManager] getReceiptData];
    if (receiptData) {
        return [receiptData UTF8String];
    }
    return NULL;
}

bool finish_transaction(const char* transaction_id) {
    if (!transaction_id) return false;
    
    NSString *transactionIdentifier = [NSString stringWithUTF8String:transaction_id];
    return [[StoreKitManager sharedManager] finishTransaction:transactionIdentifier];
}