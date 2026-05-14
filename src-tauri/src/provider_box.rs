use futures::stream::BoxStream;
use iron_providers::{InferenceRequest, Provider, ProviderEvent, ProviderResult};

/// Wrapper that implements `Provider` for `Box<dyn Provider>`.
///
/// This is needed because `Box<dyn Provider>` does not automatically implement
/// `Provider`, and `IronAgent::with_tokio_handle` requires a concrete `P: Provider`.
pub struct ProviderBox(pub Box<dyn Provider>);

unsafe impl Send for ProviderBox {}
unsafe impl Sync for ProviderBox {}

impl Provider for ProviderBox {
    fn infer(
        &self,
        request: InferenceRequest,
    ) -> iron_providers::ProviderFuture<'_, Vec<ProviderEvent>> {
        self.0.infer(request)
    }

    fn infer_stream(
        &self,
        request: InferenceRequest,
    ) -> iron_providers::ProviderFuture<'_, BoxStream<'static, ProviderResult<ProviderEvent>>> {
        self.0.infer_stream(request)
    }
}
