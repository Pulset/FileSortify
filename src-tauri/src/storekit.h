#ifndef STOREKIT_H
#define STOREKIT_H

#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

// StoreKit函数声明
bool init_store_kit(void);
bool request_products(const char* product_ids_json);
bool purchase_product(const char* product_id);
bool restore_purchases(void);
const char* get_receipt_data(void);
bool finish_transaction(const char* transaction_id);

// 回调函数声明（由Rust实现）
void on_products_received(const char* products_json);
void on_purchase_completed(const char* transaction_json);
void on_purchase_failed(const char* error_message);
void on_restore_completed(const char* transactions_json);

#ifdef __cplusplus
}
#endif

#endif // STOREKIT_H